package com.safego.demo.api;

import com.safego.demo.data.DashboardService;
import com.safego.demo.model.AccountProfile;
import com.safego.demo.model.Bookmark;
import com.safego.demo.model.ResolvedPlace;
import com.safego.demo.model.SavedPlace;
import com.safego.demo.service.AccountService;
import com.safego.demo.service.AccountService.AccountException;
import com.safego.demo.service.GeocodingService;
import com.safego.demo.util.RateLimiter;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api")
public class AccountController {
    private static final String COOKIE = "SAFEGO_SESSION";
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final RateLimiter AUTH_LIMIT = new RateLimiter();
    private final AccountService accounts;
    private final GeocodingService geocoding;
    private final DashboardService dashboard;

    public AccountController(AccountService accounts, GeocodingService geocoding, DashboardService dashboard) {
        this.accounts = accounts;
        this.geocoding = geocoding;
        this.dashboard = dashboard;
    }

    @PostMapping("/auth/register")
    public ResponseEntity<Object> register(@RequestBody(required=false) Map<String,Object> body,
            @RequestHeader(value="X-Forwarded-For",required=false) String forwarded) {
        if (!AUTH_LIMIT.tryAcquire(clientKey(forwarded), 10*60*1000L, 10)) return error(429,"RATE_LIMITED","Too many account attempts. Try again later.");
        String email=clean(body,"email"), name=clean(body,"name"), password=clean(body,"password");
        if (!EMAIL.matcher(email).matches() || email.length()>254) return error(400,"INVALID_ACCOUNT","Enter a valid email address.");
        if (name.length()<2 || name.length()>80) return error(400,"INVALID_ACCOUNT","Enter a name between 2 and 80 characters.");
        if (!strongPassword(password)) return error(400,"WEAK_PASSWORD","Use at least 10 characters with a letter and a number.");
        try { return authenticated(accounts.register(email,name,password)); } catch(AccountException e){ return error(status(e),e.code,e.getMessage()); }
    }

    @PostMapping("/auth/login")
    public ResponseEntity<Object> login(@RequestBody(required=false) Map<String,Object> body,
            @RequestHeader(value="X-Forwarded-For",required=false) String forwarded) {
        if (!AUTH_LIMIT.tryAcquire(clientKey(forwarded), 10*60*1000L, 10)) return error(429,"RATE_LIMITED","Too many account attempts. Try again later.");
        String email=clean(body,"email"), password=clean(body,"password");
        try { return authenticated(accounts.login(email,password)); } catch(AccountException e){ return error(status(e),e.code,e.getMessage()); }
    }

    @GetMapping("/auth/session")
    public ResponseEntity<Object> session(@CookieValue(value=COOKIE,required=false) String token) {
        return accounts.session(token)
            .map(profile -> noStore(ResponseEntity.ok(ApiResponse.ok(profile, profile.persistence()))))
            .orElseGet(() -> noStore(ResponseEntity.status(401).body(ApiResponse.error("UNAUTHENTICATED","No active SafeGo account session."))));
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<Object> logout(@CookieValue(value=COOKIE,required=false) String token) {
        accounts.logout(token);
        return noStore(ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, expiredCookie().toString()).body(Map.of("data",Map.of("signedOut",true))));
    }

    @PutMapping("/account/places")
    public ResponseEntity<Object> places(@CookieValue(value=COOKIE,required=false) String token,
            @RequestBody(required=false) Map<String,Object> body) {
        String home=clean(body,"home");
        if (home.length()>160) return error(400,"INVALID_PLACE","Home must be 160 characters or fewer.");
        try {
            AccountProfile current = accounts.session(token).orElseThrow(() -> new AccountException("UNAUTHORIZED", "Sign in again to update saved places."));
            // School was dropped from the app; whatever an older account saved stays untouched.
            var profile=accounts.updatePlaces(token,resolvePlace(home, current.homePlace(), body),current.schoolPlace());
            return noStore(ResponseEntity.ok(ApiResponse.ok(profile,profile.persistence())));
        }
        catch(AccountException e){ return error(status(e),e.code,e.getMessage()); }
    }

    @PostMapping("/account/bookmarks")
    public ResponseEntity<Object> addBookmark(@CookieValue(value=COOKIE,required=false) String token,
            @RequestBody(required=false) Map<String,Object> body) {
        String name=clean(body,"name"), location=clean(body,"location");
        if (location.isBlank()) return error(400,"INVALID_BOOKMARK","Enter a location to bookmark.");
        if (location.length()>160) return error(400,"INVALID_BOOKMARK","Enter a location of 160 characters or fewer.");
        if (name.length()>60) return error(400,"INVALID_BOOKMARK","Bookmark names must be 60 characters or fewer.");
        try {
            accounts.session(token).orElseThrow(() -> new AccountException("UNAUTHORIZED", "Sign in again to manage your bookmarks."));
            var profile = accounts.addBookmark(token, name.isBlank() ? location : name, resolvePlace(location, null, body));
            return noStore(ResponseEntity.ok(ApiResponse.ok(profile,profile.persistence())));
        } catch(AccountException e){ return error(status(e),e.code,e.getMessage()); }
    }

    /** Renames a bookmark, moves it to another location, or both. A blank field keeps its current value. */
    @PutMapping("/account/bookmarks/{id}")
    public ResponseEntity<Object> updateBookmark(@CookieValue(value=COOKIE,required=false) String token, @PathVariable String id,
            @RequestBody(required=false) Map<String,Object> body) {
        String name=clean(body,"name"), location=clean(body,"location");
        if (location.length()>160) return error(400,"INVALID_BOOKMARK","Enter a location of 160 characters or fewer.");
        if (name.length()>60) return error(400,"INVALID_BOOKMARK","Bookmark names must be 60 characters or fewer.");
        try {
            AccountProfile current = accounts.session(token).orElseThrow(() -> new AccountException("UNAUTHORIZED", "Sign in again to manage your bookmarks."));
            Bookmark existing = current.bookmarks().stream().filter(bookmark -> bookmark.id().equals(id)).findFirst()
                .orElseThrow(() -> new AccountException("BOOKMARK_NOT_FOUND", "That bookmark no longer exists."));
            var place = location.isBlank() ? existing.place() : resolvePlace(location, existing.place(), body);
            var profile = accounts.updateBookmark(token, id, name.isBlank() ? existing.name() : name, place);
            return noStore(ResponseEntity.ok(ApiResponse.ok(profile,profile.persistence())));
        } catch(AccountException e){ return error(status(e),e.code,e.getMessage()); }
    }

    @DeleteMapping("/account/bookmarks/{id}")
    public ResponseEntity<Object> deleteBookmark(@CookieValue(value=COOKIE,required=false) String token, @PathVariable String id) {
        try {
            var profile = accounts.deleteBookmark(token, id);
            return noStore(ResponseEntity.ok(ApiResponse.ok(profile,profile.persistence())));
        } catch(AccountException e){ return error(status(e),e.code,e.getMessage()); }
    }

    private ResponseEntity<Object> authenticated(AccountService.AuthResult result) {
        return noStore(ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, sessionCookie(result.token()).toString()).body(ApiResponse.ok(result.profile(),result.profile().persistence())));
    }
    private ResponseCookie sessionCookie(String token) { return ResponseCookie.from(COOKIE,token).httpOnly(true).secure(cookieSecure()).sameSite("Lax").path("/").maxAge(Duration.ofDays(30)).build(); }
    private ResponseCookie expiredCookie() { return ResponseCookie.from(COOKIE,"").httpOnly(true).secure(cookieSecure()).sameSite("Lax").path("/").maxAge(Duration.ZERO).build(); }
    private boolean cookieSecure() { return "true".equalsIgnoreCase(System.getenv("SAFEGO_COOKIE_SECURE")); }
    private static boolean strongPassword(String value){ return value.length()>=10 && value.length()<=128 && value.chars().anyMatch(Character::isLetter) && value.chars().anyMatch(Character::isDigit); }
    private static String clean(Map<String,Object> body,String key){ if(body==null||body.get(key)==null)return ""; return String.valueOf(body.get(key)).trim(); }
    private static String clientKey(String forwarded){ return forwarded==null||forwarded.isBlank()?"local":forwarded.split(",")[0].trim(); }
    /**
     * The saved form of a typed location. A place picked from the app's OpenStreetMap suggestions arrives
     * with its coordinates and is saved as picked; anything else is looked up by its text.
     */
    private SavedPlace resolvePlace(String label, SavedPlace existing, Map<String,Object> body) {
        if (label.isBlank()) return null;
        double[] picked = pickedCoordinates(body);
        if (picked != null) {
            String matched = clean(body, "matchedLocationId");
            boolean known = dashboard.canonicalLocations().stream().anyMatch(location -> location.id().equals(matched));
            String detail = clean(body, "detail");
            String canonical = known || detail.isBlank() || detail.length() > 300 ? label : detail.startsWith(label) ? detail : label + ", " + detail;
            return new SavedPlace(label, canonical, picked,
                known ? "preset" : "nominatim", known ? matched : null, true);
        }
        if (existing != null && label.equals(existing.label())) return existing;
        try {
            ResolvedPlace place = geocoding.resolvePlace(label, dashboard.canonicalLocations());
            return new SavedPlace(label, place.label(), place.coordinates(), place.source(), place.matchedLocationId(), place.approximate());
        } catch (Exception error) {
            throw new AccountException("PLACE_NOT_FOUND", "SafeGo could not locate \"" + label + "\" in the Philippines. Try a more specific address or landmark.");
        }
    }
    /** [latitude, longitude] sent with a picked suggestion, when present and inside the Philippines. */
    private static double[] pickedCoordinates(Map<String,Object> body) {
        if (body == null || !(body.get("coordinates") instanceof java.util.List<?> pair) || pair.size() != 2) return null;
        if (!(pair.get(0) instanceof Number lat) || !(pair.get(1) instanceof Number lon)) return null;
        double latitude = lat.doubleValue(), longitude = lon.doubleValue();
        if (!(latitude >= 4 && latitude <= 22 && longitude >= 116 && longitude <= 127)) return null;
        return new double[]{latitude, longitude};
    }
    private static int status(AccountException e){ return switch(e.code){case "EMAIL_EXISTS"->409;case "INVALID_LOGIN","UNAUTHORIZED"->401;case "PLACE_NOT_FOUND"->422;case "BOOKMARK_NOT_FOUND"->404;case "BOOKMARK_LIMIT"->409;default->503;}; }
    private static ResponseEntity<Object> error(int status,String code,String message){ return noStore(ResponseEntity.status(status).body(ApiResponse.error(code,message))); }
    private static ResponseEntity<Object> noStore(ResponseEntity<Object> response){ response.getHeaders().setCacheControl(CacheControl.noStore()); return response; }
}
