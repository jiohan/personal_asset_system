package com.jioha.asset.api;

import com.jioha.asset.api.ApiErrorResponse.ApiError;
import com.jioha.asset.api.ApiErrorResponse.FieldError;
import com.jioha.asset.auth.RequestValidationException;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

  // Slice1 hardening: map DB constraint violations (e.g. unique email) to 409 instead of 500.
  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<ApiErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException e) {
    return ResponseEntity.status(409)
        .body(new ApiErrorResponse(new ApiError("CONFLICT", "Conflict.", null)));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiErrorResponse> handleMethodArgumentNotValid(MethodArgumentNotValidException e) {
    List<FieldError> fieldErrors = e.getBindingResult().getFieldErrors().stream()
        .map(this::toFieldError)
        .collect(Collectors.toList());

    return ResponseEntity.status(422)
        .body(new ApiErrorResponse(new ApiError("VALIDATION_ERROR", "Invalid request.", fieldErrors)));
  }

  @ExceptionHandler(RequestValidationException.class)
  public ResponseEntity<ApiErrorResponse> handleRequestValidation(RequestValidationException e) {
    return ResponseEntity.status(422)
        .body(new ApiErrorResponse(new ApiError("VALIDATION_ERROR", e.getMessage(), e.fieldErrors())));
  }

  @ExceptionHandler(ConstraintViolationException.class)
  public ResponseEntity<ApiErrorResponse> handleConstraintViolation(ConstraintViolationException e) {
    return ResponseEntity.status(422)
        .body(new ApiErrorResponse(new ApiError("VALIDATION_ERROR", "Invalid request.", List.of())));
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<ApiErrorResponse> handleResponseStatus(ResponseStatusException e) {
    HttpStatus status = HttpStatus.valueOf(e.getStatusCode().value());
    String code = status == HttpStatus.UNAUTHORIZED ? "UNAUTHORIZED" : status.name();
    String message = e.getReason() != null ? e.getReason() : status.getReasonPhrase();
    return ResponseEntity.status(status)
        .body(new ApiErrorResponse(new ApiError(code, message, null)));
  }

  @ExceptionHandler(ErrorResponseException.class)
  public ResponseEntity<ApiErrorResponse> handleErrorResponseException(ErrorResponseException e) {
    HttpStatus status = HttpStatus.valueOf(e.getStatusCode().value());
    String code = status == HttpStatus.UNAUTHORIZED ? "UNAUTHORIZED" : status.name();
    String message = e.getBody().getDetail() != null ? e.getBody().getDetail() : status.getReasonPhrase();
    return ResponseEntity.status(status)
        .body(new ApiErrorResponse(new ApiError(code, message, null)));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception e) {
    return ResponseEntity.status(500)
        .body(new ApiErrorResponse(new ApiError("INTERNAL_ERROR", "Internal server error.", null)));
  }

  private FieldError toFieldError(org.springframework.validation.FieldError e) {
    String field = e.getField();
    String reason = e.getDefaultMessage() != null ? e.getDefaultMessage() : "invalid";
    return new FieldError(field, reason);
  }
}
