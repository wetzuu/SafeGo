package com.safego.demo.service;

import com.safego.demo.model.AccountProfile;
import com.safego.demo.model.Bookmark;
import com.safego.demo.model.SavedPlace;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class AccountService {
    private static final long SESSION_DAYS = 30;
    public static final int MAX_BOOKMARKS = 30;
    private static final String PROFILE_COLUMNS = "u.id user_id,u.email,u.display_name," +
        "p.home_label,p.home_canonical_label,p.home_source,p.home_matched_location_id,p.home_approximate," +
        "ST_Y(p.home_position::geometry) home_lat,ST_X(p.home_position::geometry) home_lon," +
        "p.school_label,p.school_canonical_label,p.school_source,p.school_matched_location_id,p.school_approximate," +
        "ST_Y(p.school_position::geometry) school_lat,ST_X(p.school_position::geometry) school_lon";

    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder(12);
    private final SecureRandom random = new SecureRandom();
    private final Map<String, MemoryUser> users = new ConcurrentHashMap<>();
    private final Map<String, MemorySession> sessions = new ConcurrentHashMap<>();
    private final String databaseUrl;

    public AccountService() {
        String mode = System.getenv().getOrDefault("SAFEGO_DATA_MODE", "auto").trim().toLowerCase(Locale.ROOT);
        String url = System.getenv("DATABASE_URL");
        if ("database".equals(mode) && (url == null || url.isBlank())) {
            throw new IllegalArgumentException("DATABASE_URL is required for database mode.");
        }
        databaseUrl = ("database".equals(mode) || ("auto".equals(mode) && url != null && !url.isBlank())) ? url : null;
    }

    public AuthResult register(String email, String name, String password) {
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        String hash = passwords.encode(password);
        if (databaseUrl == null) {
            MemoryUser created = new MemoryUser(normalizedEmail, name.trim(), hash);
            if (users.putIfAbsent(normalizedEmail, created) != null) throw new AccountException("EMAIL_EXISTS", "An account with that email already exists.");
            return createSession(created);
        }
        try (Connection connection = connect()) {
            UUID id = UUID.randomUUID();
            connection.setAutoCommit(false);
            try (PreparedStatement user = connection.prepareStatement("INSERT INTO app_users (id,email,display_name,password_hash) VALUES (?,?,?,?)");
                 PreparedStatement places = connection.prepareStatement("INSERT INTO user_saved_places (user_id) VALUES (?)")) {
                user.setObject(1, id); user.setString(2, normalizedEmail); user.setString(3, name.trim()); user.setString(4, hash); user.executeUpdate();
                places.setObject(1, id); places.executeUpdate();
                return createDatabaseSession(connection, id, new AccountProfile(normalizedEmail, name.trim(), "", "", null, null, List.of(), "database"));
            } catch (SQLException error) {
                connection.rollback();
                if ("23505".equals(error.getSQLState())) throw new AccountException("EMAIL_EXISTS", "An account with that email already exists.");
                throw error;
            }
        } catch (AccountException error) { throw error; }
        catch (Exception error) { throw new AccountException("ACCOUNT_UNAVAILABLE", "The account service is unavailable."); }
    }

    public AuthResult login(String email, String password) {
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        if (databaseUrl == null) {
            MemoryUser user = users.get(normalizedEmail);
            if (user == null || !passwords.matches(password, user.passwordHash)) throw invalidLogin();
            return createSession(user);
        }
        String sql = "SELECT u.id,u.password_hash," + PROFILE_COLUMNS + " FROM app_users u JOIN user_saved_places p ON p.user_id=u.id WHERE u.email=?";
        try (Connection connection = connect(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, normalizedEmail);
            try (ResultSet row = statement.executeQuery()) {
                if (!row.next() || !passwords.matches(password, row.getString("password_hash"))) throw invalidLogin();
                return createDatabaseSession(connection, row.getObject("id", UUID.class), databaseProfile(connection, row));
            }
        } catch (AccountException error) { throw error; }
        catch (Exception error) { throw new AccountException("ACCOUNT_UNAVAILABLE", "The account service is unavailable."); }
    }

    public Optional<AccountProfile> session(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return Optional.empty();
        String tokenHash = tokenHash(rawToken);
        if (databaseUrl == null) {
            MemorySession session = sessions.get(tokenHash);
            if (session == null || session.expiresAt.isBefore(Instant.now())) { sessions.remove(tokenHash); return Optional.empty(); }
            MemoryUser user = users.get(session.email);
            return user == null ? Optional.empty() : Optional.of(profile(user));
        }
        String sql = "SELECT " + PROFILE_COLUMNS + " FROM user_sessions s JOIN app_users u ON u.id=s.user_id JOIN user_saved_places p ON p.user_id=u.id WHERE s.token_hash=? AND s.expires_at>now()";
        try (Connection connection = connect(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, tokenHash);
            try (ResultSet row = statement.executeQuery()) {
                return row.next() ? Optional.of(databaseProfile(connection, row)) : Optional.empty();
            }
        } catch (Exception error) { throw new AccountException("ACCOUNT_UNAVAILABLE", "The account service is unavailable."); }
    }

    public AccountProfile updatePlaces(String rawToken, SavedPlace home, SavedPlace school) {
        AccountProfile current = session(rawToken).orElseThrow(() -> new AccountException("UNAUTHORIZED", "Sign in again to update saved places."));
        if (databaseUrl == null) {
            MemoryUser user = users.get(current.email());
            user.home = home; user.school = school;
            return profile(user);
        }
        String sql = "UPDATE user_saved_places p SET " +
            "home_label=?,home_canonical_label=?,home_position=ST_SetSRID(ST_MakePoint(?,?),4326)::geography,home_source=?,home_matched_location_id=?,home_approximate=?," +
            "school_label=?,school_canonical_label=?,school_position=ST_SetSRID(ST_MakePoint(?,?),4326)::geography,school_source=?,school_matched_location_id=?,school_approximate=?,updated_at=now() " +
            "FROM user_sessions s WHERE s.user_id=p.user_id AND s.token_hash=? AND s.expires_at>now()";
        try (Connection connection = connect(); PreparedStatement statement = connection.prepareStatement(sql)) {
            int next = bindPlace(statement, 1, home);
            next = bindPlace(statement, next, school);
            statement.setString(next, tokenHash(rawToken));
            if (statement.executeUpdate() != 1) throw new AccountException("UNAUTHORIZED", "Sign in again to update saved places.");
            return new AccountProfile(current.email(), current.name(), label(home), label(school), home, school, current.bookmarks(), "database");
        } catch (AccountException error) { throw error; }
        catch (Exception error) { throw new AccountException("ACCOUNT_UNAVAILABLE", "Saved places could not be updated."); }
    }

    public AccountProfile addBookmark(String rawToken, String name, SavedPlace place) {
        AccountProfile current = requireSession(rawToken);
        if (current.bookmarks().size() >= MAX_BOOKMARKS) {
            throw new AccountException("BOOKMARK_LIMIT", "You can keep up to " + MAX_BOOKMARKS + " bookmarks. Delete one to add another.");
        }
        UUID id = UUID.randomUUID();
        if (databaseUrl == null) {
            MemoryUser user = users.get(current.email());
            user.bookmarks.add(new Bookmark(id.toString(), name, place));
            return profile(user);
        }
        String sql = "INSERT INTO user_bookmarks (id,user_id,name,label,canonical_label,position,source,matched_location_id,approximate) " +
            "SELECT ?,s.user_id,?,?,?,ST_SetSRID(ST_MakePoint(?,?),4326)::geography,?,?,? FROM user_sessions s WHERE s.token_hash=? AND s.expires_at>now()";
        try (Connection connection = connect(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, id);
            int next = bindBookmark(statement, 2, name, place);
            statement.setString(next, tokenHash(rawToken));
            if (statement.executeUpdate() != 1) throw unauthorized();
        } catch (AccountException error) { throw error; }
        catch (Exception error) { throw new AccountException("ACCOUNT_UNAVAILABLE", "The bookmark could not be saved."); }
        return requireSession(rawToken);
    }

    public AccountProfile updateBookmark(String rawToken, String bookmarkId, String name, SavedPlace place) {
        AccountProfile current = requireSession(rawToken);
        if (current.bookmarks().stream().noneMatch(bookmark -> bookmark.id().equals(bookmarkId))) throw bookmarkNotFound();
        if (databaseUrl == null) {
            MemoryUser user = users.get(current.email());
            user.bookmarks.replaceAll(bookmark -> bookmark.id().equals(bookmarkId) ? new Bookmark(bookmarkId, name, place) : bookmark);
            return profile(user);
        }
        String sql = "UPDATE user_bookmarks b SET name=?,label=?,canonical_label=?,position=ST_SetSRID(ST_MakePoint(?,?),4326)::geography," +
            "source=?,matched_location_id=?,approximate=?,updated_at=now() " +
            "FROM user_sessions s WHERE b.id=? AND b.user_id=s.user_id AND s.token_hash=? AND s.expires_at>now()";
        try (Connection connection = connect(); PreparedStatement statement = connection.prepareStatement(sql)) {
            int next = bindBookmark(statement, 1, name, place);
            statement.setObject(next, UUID.fromString(bookmarkId));
            statement.setString(next + 1, tokenHash(rawToken));
            if (statement.executeUpdate() != 1) throw bookmarkNotFound();
        } catch (AccountException error) { throw error; }
        catch (Exception error) { throw new AccountException("ACCOUNT_UNAVAILABLE", "The bookmark could not be updated."); }
        return requireSession(rawToken);
    }

    public AccountProfile deleteBookmark(String rawToken, String bookmarkId) {
        AccountProfile current = requireSession(rawToken);
        if (current.bookmarks().stream().noneMatch(bookmark -> bookmark.id().equals(bookmarkId))) throw bookmarkNotFound();
        if (databaseUrl == null) {
            MemoryUser user = users.get(current.email());
            user.bookmarks.removeIf(bookmark -> bookmark.id().equals(bookmarkId));
            return profile(user);
        }
        String sql = "DELETE FROM user_bookmarks b USING user_sessions s WHERE b.id=? AND b.user_id=s.user_id AND s.token_hash=? AND s.expires_at>now()";
        try (Connection connection = connect(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, UUID.fromString(bookmarkId));
            statement.setString(2, tokenHash(rawToken));
            if (statement.executeUpdate() != 1) throw bookmarkNotFound();
        } catch (AccountException error) { throw error; }
        catch (Exception error) { throw new AccountException("ACCOUNT_UNAVAILABLE", "The bookmark could not be deleted."); }
        return requireSession(rawToken);
    }

    private AccountProfile requireSession(String rawToken) {
        return session(rawToken).orElseThrow(AccountService::unauthorized);
    }

    private static AccountException unauthorized() { return new AccountException("UNAUTHORIZED", "Sign in again to manage your bookmarks."); }
    private static AccountException bookmarkNotFound() { return new AccountException("BOOKMARK_NOT_FOUND", "That bookmark no longer exists."); }

    private int bindBookmark(PreparedStatement statement, int start, String name, SavedPlace place) throws SQLException {
        statement.setString(start, name); statement.setString(start + 1, place.label()); statement.setString(start + 2, place.canonicalLabel());
        statement.setDouble(start + 3, place.coordinates()[1]); statement.setDouble(start + 4, place.coordinates()[0]);
        statement.setString(start + 5, place.source()); statement.setString(start + 6, place.matchedLocationId()); statement.setBoolean(start + 7, place.approximate());
        return start + 8;
    }

    /** An account's bookmarks, oldest first. Empty until the bookmarks migration has been applied. */
    private List<Bookmark> databaseBookmarks(Connection connection, UUID userId) throws SQLException {
        String sql = "SELECT id,name,label,canonical_label,source,matched_location_id,approximate," +
            "ST_Y(position::geometry) lat,ST_X(position::geometry) lon FROM user_bookmarks WHERE user_id=? ORDER BY created_at,id";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, userId);
            List<Bookmark> bookmarks = new ArrayList<>();
            try (ResultSet row = statement.executeQuery()) {
                while (row.next()) {
                    bookmarks.add(new Bookmark(row.getString("id"), row.getString("name"), new SavedPlace(row.getString("label"),
                        row.getString("canonical_label"), new double[]{row.getDouble("lat"), row.getDouble("lon")},
                        row.getString("source"), row.getString("matched_location_id"), row.getBoolean("approximate"))));
                }
            }
            return List.copyOf(bookmarks);
        } catch (SQLException error) {
            if ("42P01".equals(error.getSQLState())) return List.of();
            throw error;
        }
    }

    public void logout(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return;
        String hash = tokenHash(rawToken);
        if (databaseUrl == null) { sessions.remove(hash); return; }
        try (Connection connection = connect(); PreparedStatement statement = connection.prepareStatement("DELETE FROM user_sessions WHERE token_hash=?")) {
            statement.setString(1, hash); statement.executeUpdate();
        } catch (Exception ignored) {}
    }

    private AuthResult createSession(MemoryUser user) {
        String token = randomToken();
        sessions.put(tokenHash(token), new MemorySession(user.email, Instant.now().plus(SESSION_DAYS, ChronoUnit.DAYS)));
        return new AuthResult(profile(user), token);
    }

    private AuthResult createDatabaseSession(Connection connection, UUID id, AccountProfile profile) throws SQLException {
        String token = randomToken();
        try (PreparedStatement statement = connection.prepareStatement("INSERT INTO user_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)")) {
            statement.setString(1, tokenHash(token)); statement.setObject(2, id); statement.setTimestamp(3, Timestamp.from(Instant.now().plus(SESSION_DAYS, ChronoUnit.DAYS))); statement.executeUpdate();
            if (!connection.getAutoCommit()) connection.commit();
        }
        return new AuthResult(profile, token);
    }

    private AccountProfile databaseProfile(Connection connection, ResultSet row) throws SQLException {
        SavedPlace home = readPlace(row, "home");
        SavedPlace school = readPlace(row, "school");
        return new AccountProfile(row.getString("email"), row.getString("display_name"), label(home), label(school), home, school,
            databaseBookmarks(connection, row.getObject("user_id", UUID.class)), "database");
    }

    private SavedPlace readPlace(ResultSet row, String prefix) throws SQLException {
        String label = row.getString(prefix + "_label");
        if (label == null || label.isBlank()) return null;
        double lat = row.getDouble(prefix + "_lat");
        if (row.wasNull()) return null;
        double lon = row.getDouble(prefix + "_lon");
        return new SavedPlace(label, row.getString(prefix + "_canonical_label"), new double[]{lat, lon},
            row.getString(prefix + "_source"), row.getString(prefix + "_matched_location_id"), row.getBoolean(prefix + "_approximate"));
    }

    private int bindPlace(PreparedStatement statement, int start, SavedPlace place) throws SQLException {
        if (place == null) {
            statement.setString(start, ""); statement.setNull(start + 1, Types.VARCHAR);
            statement.setNull(start + 2, Types.DOUBLE); statement.setNull(start + 3, Types.DOUBLE);
            statement.setNull(start + 4, Types.VARCHAR); statement.setNull(start + 5, Types.VARCHAR); statement.setNull(start + 6, Types.BOOLEAN);
        } else {
            statement.setString(start, place.label()); statement.setString(start + 1, place.canonicalLabel());
            statement.setDouble(start + 2, place.coordinates()[1]); statement.setDouble(start + 3, place.coordinates()[0]);
            statement.setString(start + 4, place.source()); statement.setString(start + 5, place.matchedLocationId()); statement.setBoolean(start + 6, place.approximate());
        }
        return start + 7;
    }

    private AccountProfile profile(MemoryUser user) { return new AccountProfile(user.email, user.name, label(user.home), label(user.school), user.home, user.school, List.copyOf(user.bookmarks), "process"); }
    private String label(SavedPlace place) { return place == null ? "" : place.label(); }
    private String randomToken() { byte[] bytes = new byte[32]; random.nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
    private String tokenHash(String token) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); } catch (Exception e) { throw new IllegalStateException(e); } }
    private AccountException invalidLogin() { return new AccountException("INVALID_LOGIN", "The email or password is incorrect."); }

    private Connection connect() throws Exception {
        URI uri = URI.create(databaseUrl);
        Properties properties = new Properties();
        if (uri.getRawUserInfo() != null) { String[] parts = uri.getRawUserInfo().split(":", 2); properties.setProperty("user", URLDecoder.decode(parts[0], StandardCharsets.UTF_8)); if (parts.length > 1) properties.setProperty("password", URLDecoder.decode(parts[1], StandardCharsets.UTF_8)); }
        if ("true".equalsIgnoreCase(System.getenv("DATABASE_SSL"))) properties.setProperty("sslmode", "require");
        String jdbc = "jdbc:postgresql://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "") + uri.getRawPath();
        return DriverManager.getConnection(jdbc, properties);
    }

    public record AuthResult(AccountProfile profile, String token) {}
    private static class MemoryUser { final String email; final String name; final String passwordHash; volatile SavedPlace home; volatile SavedPlace school; final List<Bookmark> bookmarks = new CopyOnWriteArrayList<>(); MemoryUser(String email,String name,String passwordHash){this.email=email;this.name=name;this.passwordHash=passwordHash;} }
    private record MemorySession(String email, Instant expiresAt) {}
    public static class AccountException extends RuntimeException { public final String code; public AccountException(String code,String message){super(message);this.code=code;} }
}
