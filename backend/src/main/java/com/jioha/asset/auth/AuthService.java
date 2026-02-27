package com.jioha.asset.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.session.FindByIndexNameSessionRepository;

import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class AuthService {

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;
  private final AuthenticationManager authenticationManager;
  private final SecurityContextRepository securityContextRepository;

  public AuthService(UserRepository userRepository,
      PasswordEncoder passwordEncoder,
      AuthenticationManager authenticationManager,
      SecurityContextRepository securityContextRepository) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
    this.authenticationManager = authenticationManager;
    this.securityContextRepository = securityContextRepository;
  }

  @Transactional
  public AuthMeResponse signupAndLogin(AuthSignupRequest request, HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {
    String email = safeTrim(request.email());
    String emailNormalized = normalizeEmail(email);

    if (userRepository.existsByEmailNormalized(emailNormalized)) {
      // Slice1 hardening: duplicate signup is a conflict (not a generic validation error).
      throw new ResponseStatusException(CONFLICT, "Email already exists.");
    }

    UserEntity saved;
    try {
      UserEntity user = new UserEntity();
      user.setEmail(email);
      user.setEmailNormalized(emailNormalized);
      user.setPasswordHash(passwordEncoder.encode(request.password()));
      saved = userRepository.save(user);
    } catch (DataIntegrityViolationException e) {
      // Slice1 hardening: guard against concurrent signups (DB unique constraint wins).
      throw new ResponseStatusException(CONFLICT, "Email already exists.");
    }

    AuthUserPrincipal principal = new AuthUserPrincipal(saved.getId(), saved.getEmail(), saved.getEmailNormalized());
    Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(principal, null, List.of());
    saveAuthentication(authentication, httpRequest, httpResponse);
    return new AuthMeResponse(saved.getId(), saved.getEmail());
  }

  public AuthMeResponse login(AuthLoginRequest request, HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {
    String emailNormalized = normalizeEmail(request.email());
    try {
      Authentication authentication = authenticationManager.authenticate(
          UsernamePasswordAuthenticationToken.unauthenticated(emailNormalized, request.password()));
      Object p = authentication.getPrincipal();
      AuthUserPrincipal principal;
      if (p instanceof AuthUserDetails d) {
        // Slice1 hardening: store a password-less principal in session.
        principal = new AuthUserPrincipal(d.userId(), d.email(), d.emailNormalized());
      } else if (p instanceof AuthUserPrincipal pr) {
        principal = pr;
      } else {
        throw new ResponseStatusException(UNAUTHORIZED, "Unauthorized.");
      }

      Authentication sanitized = UsernamePasswordAuthenticationToken.authenticated(principal, null, List.of());
      saveAuthentication(sanitized, httpRequest, httpResponse);
      return new AuthMeResponse(principal.userId(), principal.email());
    } catch (BadCredentialsException e) {
      throw new ResponseStatusException(UNAUTHORIZED, "Invalid credentials.");
    }
  }

  public void logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    new SecurityContextLogoutHandler().logout(httpRequest, httpResponse, authentication);
  }

  public AuthMeResponse me() {
    Authentication authentication = Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
        .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Unauthorized."));

    Object p = authentication.getPrincipal();
    if (p instanceof AuthUserDetails d) {
      return new AuthMeResponse(d.userId(), d.email());
    }

    if (!(p instanceof AuthUserPrincipal principal)) {
      throw new ResponseStatusException(UNAUTHORIZED, "Unauthorized.");
    }

    return new AuthMeResponse(principal.userId(), principal.email());
  }

  private void saveAuthentication(Authentication authentication, HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {
    // Slice1 hardening: prevent session fixation when manually creating an authenticated session.
    httpRequest.getSession(true);
    httpRequest.changeSessionId();

    // Slice1 hardening: ensure spring_session.principal_name is populated for indexed session queries.
    String principalName = resolvePrincipalName(authentication);
    httpRequest.getSession().setAttribute(FindByIndexNameSessionRepository.PRINCIPAL_NAME_INDEX_NAME, principalName);

    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    securityContextRepository.saveContext(context, httpRequest, httpResponse);
  }

  private static String resolvePrincipalName(Authentication authentication) {
    Object p = authentication.getPrincipal();
    if (p instanceof AuthUserPrincipal principal) {
      return principal.emailNormalized();
    }
    if (p instanceof AuthUserDetails details) {
      return details.emailNormalized();
    }
    return authentication.getName();
  }

  private static String normalizeEmail(String email) {
    return safeTrim(email).toLowerCase(Locale.ROOT);
  }

  private static String safeTrim(String value) {
    return value == null ? "" : value.trim();
  }
}
