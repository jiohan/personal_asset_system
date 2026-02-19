package com.jioha.asset.api.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

  private final AuthService authService;

  public AuthController(AuthService authService) {
    this.authService = authService;
  }

  @PostMapping("/signup")
  @ResponseStatus(HttpStatus.CREATED)
  public AuthMeResponse signup(@Valid @RequestBody AuthSignupRequest request, HttpServletRequest httpRequest) {
    SessionUser user = authService.signup(request.email(), request.password());
    establishAuthenticatedSession(user, httpRequest);
    return new AuthMeResponse(user.id(), user.email());
  }

  @PostMapping("/login")
  public AuthMeResponse login(@Valid @RequestBody AuthLoginRequest request, HttpServletRequest httpRequest) {
    SessionUser user = authService.authenticate(request.email(), request.password());
    establishAuthenticatedSession(user, httpRequest);
    return new AuthMeResponse(user.id(), user.email());
  }

  @GetMapping("/me")
  public AuthMeResponse me(Authentication authentication) {
    SessionUser user = (SessionUser) authentication.getPrincipal();
    return new AuthMeResponse(user.id(), user.email());
  }

  @PostMapping("/logout")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void logout(HttpServletRequest request) {
    HttpSession session = request.getSession(false);
    if (session != null) {
      session.invalidate();
    }
    SecurityContextHolder.clearContext();
  }

  private void establishAuthenticatedSession(SessionUser user, HttpServletRequest httpRequest) {
    Authentication authentication = new UsernamePasswordAuthenticationToken(
        user,
        null,
        List.of(new SimpleGrantedAuthority("ROLE_USER")));

    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);

    HttpSession session = httpRequest.getSession(true);
    session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
  }
}
