package com.jioha.asset.api.common;

import com.jioha.asset.api.auth.EmailAlreadyExistsException;
import com.jioha.asset.api.auth.InvalidCredentialsException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
    List<ApiErrorResponse.FieldError> fieldErrors = exception.getBindingResult()
        .getFieldErrors()
        .stream()
        .map(this::mapFieldError)
        .toList();

    return ResponseEntity.unprocessableEntity()
        .body(ApiErrorResponse.of("VALIDATION_ERROR", "Request validation failed", fieldErrors));
  }

  @ExceptionHandler(InvalidCredentialsException.class)
  public ResponseEntity<ApiErrorResponse> handleInvalidCredentials(InvalidCredentialsException exception) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(ApiErrorResponse.of("UNAUTHORIZED", "Invalid email or password"));
  }

  @ExceptionHandler(EmailAlreadyExistsException.class)
  public ResponseEntity<ApiErrorResponse> handleEmailAlreadyExists(EmailAlreadyExistsException exception) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(ApiErrorResponse.of("CONFLICT", "Email already exists"));
  }

  private ApiErrorResponse.FieldError mapFieldError(FieldError error) {
    String reason = error.getDefaultMessage() == null ? "invalid" : error.getDefaultMessage();
    return new ApiErrorResponse.FieldError(error.getField(), reason);
  }
}
