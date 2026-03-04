package com.jioha.asset.api.patch;

import java.util.Set;

public record PatchPayload<T>(T value, Set<String> presentFields) {

  public boolean has(String fieldName) {
    return presentFields.contains(fieldName);
  }
}
