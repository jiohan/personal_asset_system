package com.jioha.asset.api.auth;

import java.io.Serial;
import java.io.Serializable;

public record SessionUser(long id, String email) implements Serializable {
  @Serial
  private static final long serialVersionUID = 1L;
}
