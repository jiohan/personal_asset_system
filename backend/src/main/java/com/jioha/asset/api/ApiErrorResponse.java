package com.jioha.asset.api;

import java.util.List;

public record ApiErrorResponse(ApiError error) {

  public record ApiError(String code, String message, List<FieldError> fieldErrors) {
  }

  public record FieldError(String field, String reason) {
  }
}
