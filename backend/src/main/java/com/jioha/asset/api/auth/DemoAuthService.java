package com.jioha.asset.api.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class DemoAuthService {
  private final String demoEmail;
  private final String demoPassword;
  private final long demoUserId;

  public DemoAuthService(
      @Value("${app.auth.demo.email:demo@local.dev}") String demoEmail,
      @Value("${app.auth.demo.password:demo12345}") String demoPassword,
      @Value("${app.auth.demo.user-id:1}") long demoUserId) {
    this.demoEmail = demoEmail;
    this.demoPassword = demoPassword;
    this.demoUserId = demoUserId;
  }

  public SessionUser authenticate(String email, String password) {
    if (demoEmail.equalsIgnoreCase(email) && demoPassword.equals(password)) {
      return new SessionUser(demoUserId, demoEmail);
    }
    throw new InvalidCredentialsException();
  }
}
