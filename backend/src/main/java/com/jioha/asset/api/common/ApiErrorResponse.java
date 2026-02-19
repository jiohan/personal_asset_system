package com.jioha.asset.api.common;

import java.util.List;

public record ApiErrorResponse(ApiError error) {
  public static ApiErrorResponse of(String code, String message) {
    return new ApiErrorResponse(new ApiError(code, message, List.of()));
  }

  public static ApiErrorResponse of(String code, String message, List<FieldError> fieldErrors) {
    return new ApiErrorResponse(new ApiError(code, message, fieldErrors));
  }

  public record ApiError(String code, String message, List<FieldError> fieldErrors) {
  }

  public record FieldError(String field, String reason) {
  }
}
