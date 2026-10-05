package com.safego.demo.service;

import com.safego.demo.model.SavedPlace;
import com.safego.demo.service.AccountService.AccountException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AccountServiceTest {
    @Test
    void registersAuthenticatesAndUpdatesSavedPlacesInDemoMode() {
        AccountService accounts = new AccountService();
        String email = "demo-" + System.nanoTime() + "@safego.test";

        var registration = accounts.register(email, "Demo Traveler", "safe-password-123");
        assertEquals("process", registration.profile().persistence());
        assertEquals(email, registration.profile().email());
        assertTrue(accounts.session(registration.token()).isPresent());

        var home = new SavedPlace("Buting, Pasig", "Buting, Pasig City", new double[]{14.5547, 121.0754}, "nominatim", null, true);
        var school = new SavedPlace("Mapúa Makati", "Mapúa University, Makati", new double[]{14.5665, 121.02}, "preset", "mapua-makati", true);
        var updated = accounts.updatePlaces(registration.token(), home, school);
        assertEquals("Buting, Pasig", updated.home());
        assertEquals("Mapúa Makati", updated.school());
        assertArrayEquals(new double[]{14.5547, 121.0754}, updated.homePlace().coordinates());

        accounts.logout(registration.token());
        assertTrue(accounts.session(registration.token()).isEmpty());

        var login = accounts.login(email, "safe-password-123");
        assertEquals("Buting, Pasig", login.profile().home());
        assertEquals("mapua-makati", login.profile().schoolPlace().matchedLocationId());
    }

    @Test
    void addsRenamesMovesAndDeletesBookmarks() {
        AccountService accounts = new AccountService();
        String token = accounts.register("bookmarks-" + System.nanoTime() + "@safego.test", "Demo Traveler", "safe-password-123").token();
        var gym = new SavedPlace("Ortigas Center", "Ortigas Center, Pasig", new double[]{14.5866, 121.0615}, "preset", "ortigas-pasig", true);
        var lola = new SavedPlace("Marikina Riverbanks", "Riverbanks, Marikina", new double[]{14.6335, 121.0836}, "nominatim", null, true);

        accounts.addBookmark(token, "Gym", gym);
        var added = accounts.addBookmark(token, "Lola's house", lola);
        assertEquals(java.util.List.of("Gym", "Lola's house"), added.bookmarks().stream().map(b -> b.name()).toList());
        String gymId = added.bookmarks().get(0).id();

        var renamed = accounts.updateBookmark(token, gymId, "Office", lola);
        assertEquals("Office", renamed.bookmarks().get(0).name());
        assertEquals("Marikina Riverbanks", renamed.bookmarks().get(0).place().label());
        assertEquals(2, renamed.bookmarks().size());

        var deleted = accounts.deleteBookmark(token, gymId);
        assertEquals(1, deleted.bookmarks().size());
        assertEquals("BOOKMARK_NOT_FOUND", assertThrows(AccountException.class, () -> accounts.deleteBookmark(token, gymId)).code);
        assertEquals("BOOKMARK_NOT_FOUND", assertThrows(AccountException.class, () -> accounts.updateBookmark(token, "nope", "X", gym)).code);
        assertEquals("UNAUTHORIZED", assertThrows(AccountException.class, () -> accounts.addBookmark("bad-token", "X", gym)).code);

        // Another account never sees or touches these bookmarks.
        String other = accounts.register("other-" + System.nanoTime() + "@safego.test", "Other", "safe-password-123").token();
        assertTrue(accounts.session(other).orElseThrow().bookmarks().isEmpty());
        String remaining = deleted.bookmarks().get(0).id();
        assertEquals("BOOKMARK_NOT_FOUND", assertThrows(AccountException.class, () -> accounts.deleteBookmark(other, remaining)).code);

        for (int i = 1; i < AccountService.MAX_BOOKMARKS; i++) accounts.addBookmark(token, "Place " + i, gym);
        assertEquals("BOOKMARK_LIMIT", assertThrows(AccountException.class, () -> accounts.addBookmark(token, "One too many", gym)).code);
    }

    @Test
    void rejectsDuplicateAccountsAndIncorrectPasswords() {
        AccountService accounts = new AccountService();
        String email = "duplicate-" + System.nanoTime() + "@safego.test";
        accounts.register(email, "Demo Traveler", "safe-password-123");

        AccountException duplicate = assertThrows(AccountException.class,
            () -> accounts.register(email.toUpperCase(), "Other Name", "another-password-456"));
        assertEquals("EMAIL_EXISTS", duplicate.code);

        AccountException invalid = assertThrows(AccountException.class,
            () -> accounts.login(email, "wrong-password-789"));
        assertEquals("INVALID_LOGIN", invalid.code);
    }
}
