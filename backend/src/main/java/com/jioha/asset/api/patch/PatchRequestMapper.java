package com.jioha.asset.api.patch;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jioha.asset.api.ApiErrorResponse.FieldError;
import com.jioha.asset.auth.RequestValidationException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class PatchRequestMapper {

  private final ObjectMapper objectMapper;
  private final Validator validator;

  public PatchRequestMapper(ObjectMapper objectMapper, Validator validator) {
    this.objectMapper = objectMapper;
    this.validator = validator;
  }

  public <T> PatchPayload<T> map(JsonNode body, Class<T> valueType) {
    T value = objectMapper.convertValue(body, valueType);
    validate(value);
    return new PatchPayload<>(value, collectPresentFields(body));
  }

  private <T> void validate(T value) {
    Set<ConstraintViolation<T>> violations = validator.validate(value);
    if (violations.isEmpty()) {
      return;
    }

    List<FieldError> fieldErrors = violations.stream()
        .sorted(Comparator.comparing((ConstraintViolation<T> v) -> v.getPropertyPath().toString()))
        .map((v) -> new FieldError(v.getPropertyPath().toString(), v.getMessage()))
        .toList();
    throw new RequestValidationException("Invalid request.", fieldErrors);
  }

  private Set<String> collectPresentFields(JsonNode body) {
    Set<String> fields = new HashSet<>();
    body.fieldNames().forEachRemaining(fields::add);
    return Set.copyOf(fields);
  }
}
