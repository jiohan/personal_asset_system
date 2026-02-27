package com.jioha.asset.auth;

// Slice1 hardening: principal stored in session should not carry passwordHash.
public record AuthUserPrincipal(long userId, String email, String emailNormalized)
    implements java.security.Principal, java.io.Serializable {

  @Override
  public String getName() {
    return emailNormalized;
  }
}
