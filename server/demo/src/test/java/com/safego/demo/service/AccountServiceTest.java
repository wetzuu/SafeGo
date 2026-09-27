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
