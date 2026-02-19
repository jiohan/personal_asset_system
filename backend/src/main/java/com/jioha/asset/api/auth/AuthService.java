package com.jioha.asset.api.auth;

import java.util.List;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  private final JdbcTemplate jdbcTemplate;
  private final PasswordEncoder passwordEncoder;

  public AuthService(JdbcTemplate jdbcTemplate, PasswordEncoder passwordEncoder) {
    this.jdbcTemplate = jdbcTemplate;
    this.passwordEncoder = passwordEncoder;
  }

  @Transactional
  public SessionUser signup(String email, String rawPassword) {
    String normalizedEmail = normalizeEmail(email);
    String trimmedEmail = email.trim();
    String passwordHash = passwordEncoder.encode(rawPassword);

    try {
      Long createdUserId = jdbcTemplate.queryForObject(
          """
              INSERT INTO users (email, email_normalized, password_hash)
              VALUES (?, ?, ?)
              RETURNING id
              """,
          Long.class,
          trimmedEmail,
          normalizedEmail,
          passwordHash
      );

      if (createdUserId == null) {
        throw new IllegalStateException("Failed to create user");
      }

      return new SessionUser(createdUserId, trimmedEmail);
    } catch (DataIntegrityViolationException exception) {
      throw new EmailAlreadyExistsException();
    }
  }

  @Transactional(readOnly = true)
  public SessionUser authenticate(String email, String rawPassword) {
    List<UserCredential> users = jdbcTemplate.query(
        """
            SELECT id, email, password_hash
            FROM users
            WHERE email_normalized = ?
            """,
        (resultSet, rowNum) -> new UserCredential(
            resultSet.getLong("id"),
            resultSet.getString("email"),
            resultSet.getString("password_hash")),
        normalizeEmail(email)
    );

    if (users.isEmpty()) {
      throw new InvalidCredentialsException();
    }

    UserCredential user = users.get(0);
    if (!passwordEncoder.matches(rawPassword, user.passwordHash())) {
      throw new InvalidCredentialsException();
    }

    return new SessionUser(user.id(), user.email());
  }

  private static String normalizeEmail(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }

  private record UserCredential(long id, String email, String passwordHash) {
  }
}
