package com.jioha.asset.auth;

import com.jioha.asset.api.ApiErrorResponse.FieldError;
import java.util.List;

public class RequestValidationException extends RuntimeException {

  private final List<FieldError> fieldErrors;

  public RequestValidationException(String message, List<FieldError> fieldErrors) {
    super(message);
    this.fieldErrors = fieldErrors;
  }

  public List<FieldError> fieldErrors() {
    return fieldErrors;
  }
}
