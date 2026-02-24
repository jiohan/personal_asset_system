package com.jioha.asset.auth;

import com.jioha.asset.api.ApiErrorResponse.FieldError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
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
      throw new RequestValidationException("Invalid request.", List.of(new FieldError("email", "already exists")));
    }

    UserEntity user = new UserEntity();
    user.setEmail(email);
    user.setEmailNormalized(emailNormalized);
    user.setPasswordHash(passwordEncoder.encode(request.password()));
    UserEntity saved = userRepository.save(user);

    AuthUserPrincipal principal = new AuthUserPrincipal(saved.getId(), saved.getEmail(), saved.getEmailNormalized(), saved.getPasswordHash());
    Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities());
    saveAuthentication(authentication, httpRequest, httpResponse);
    return new AuthMeResponse(saved.getId(), saved.getEmail());
  }

  public AuthMeResponse login(AuthLoginRequest request, HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {
    String emailNormalized = normalizeEmail(request.email());
    try {
      Authentication authentication = authenticationManager.authenticate(
          UsernamePasswordAuthenticationToken.unauthenticated(emailNormalized, request.password()));
      saveAuthentication(authentication, httpRequest, httpResponse);
      AuthUserPrincipal principal = (AuthUserPrincipal) authentication.getPrincipal();
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
    if (!(p instanceof AuthUserPrincipal principal)) {
      throw new ResponseStatusException(UNAUTHORIZED, "Unauthorized.");
    }

    return new AuthMeResponse(principal.userId(), principal.email());
  }

  private void saveAuthentication(Authentication authentication, HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {
    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    securityContextRepository.saveContext(context, httpRequest, httpResponse);
  }

  private static String normalizeEmail(String email) {
    return safeTrim(email).toLowerCase(Locale.ROOT);
  }

  private static String safeTrim(String value) {
    return value == null ? "" : value.trim();
  }
}
