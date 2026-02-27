package com.jioha.asset.auth;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

  private final AuthService authService;

  public AuthController(AuthService authService) {
    this.authService = authService;
  }

  // Slice1 hardening: CSRF bootstrap endpoint (GET triggers XSRF-TOKEN cookie issuance).
  @GetMapping("/csrf")
  public ResponseEntity<Void> csrf() {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/signup")
  public ResponseEntity<AuthMeResponse> signup(@Valid @RequestBody AuthSignupRequest request,
      jakarta.servlet.http.HttpServletRequest httpRequest,
      jakarta.servlet.http.HttpServletResponse httpResponse) {
    AuthMeResponse me = authService.signupAndLogin(request, httpRequest, httpResponse);
    return ResponseEntity.status(201).body(me);
  }

  @PostMapping("/login")
  public AuthMeResponse login(@Valid @RequestBody AuthLoginRequest request,
      jakarta.servlet.http.HttpServletRequest httpRequest,
      jakarta.servlet.http.HttpServletResponse httpResponse) {
    return authService.login(request, httpRequest, httpResponse);
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(jakarta.servlet.http.HttpServletRequest httpRequest,
      jakarta.servlet.http.HttpServletResponse httpResponse) {
    authService.logout(httpRequest, httpResponse);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/me")
  public AuthMeResponse me() {
    return authService.me();
  }
}
