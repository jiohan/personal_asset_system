package com.jioha.asset.csvimport;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jioha.asset.account.AccountEntity;
import com.jioha.asset.account.AccountRepository;
import com.jioha.asset.api.ApiErrorResponse.FieldError;
import com.jioha.asset.auth.AuthUserDetails;
import com.jioha.asset.auth.AuthUserPrincipal;
import com.jioha.asset.auth.RequestValidationException;
import com.jioha.asset.domain.TransactionDraft;
import com.jioha.asset.domain.TransactionRuleValidator;
import com.jioha.asset.domain.TransactionType;
import com.jioha.asset.transaction.SourceType;
import com.jioha.asset.transaction.TransactionEntity;
import com.jioha.asset.transaction.TransactionRepository;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class CsvImportService {

  private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
  private static final Pattern WHITESPACE = Pattern.compile("\\s+");
  private static final List<DateTimeFormatter> DATE_FORMATTERS = List.of(
      DateTimeFormatter.ISO_LOCAL_DATE,
      DateTimeFormatter.ofPattern("yyyy/MM/dd"),
      DateTimeFormatter.ofPattern("yyyy.MM.dd"));
  private static final List<DateTimeFormatter> DATE_TIME_FORMATTERS = List.of(
      DateTimeFormatter.ISO_LOCAL_DATE_TIME,
      DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
      DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm:ss"),
      DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm:ss"));

  private final ObjectMapper objectMapper;
  private final AccountRepository accountRepository;
  private final TransactionRepository transactionRepository;

  public CsvImportService(
      ObjectMapper objectMapper,
      AccountRepository accountRepository,
      TransactionRepository transactionRepository) {
    this.objectMapper = objectMapper;
    this.accountRepository = accountRepository;
    this.transactionRepository = transactionRepository;
  }

  @Transactional
  public CsvImportResultResponse importCsv(MultipartFile file, String mappingJson) {
    if (file == null || file.isEmpty()) {
      throw new RequestValidationException("CSV import failed.", List.of(new FieldError("file", "is required")));
    }

    long userId = currentUserId();
    CsvImportMappingPayload mapping = parseMapping(mappingJson);
    validateMapping(mapping);

    ParsedCsv parsedCsv = parseCsv(file);
    Map<String, Integer> headerIndexByName = headerIndexByName(parsedCsv.header());
    validateHeaders(headerIndexByName, mapping.columns());

    Map<Long, AccountEntity> activeAccountById = loadActiveAccounts(userId);
    Map<String, Long> accountNameMap = normalizeAccountNameMap(mapping.accountNameMap(), activeAccountById);

    Set<DuplicateKey> seenKeys = new LinkedHashSet<>();
    for (TransactionEntity entity : transactionRepository.findAllByUserIdAndDeletedAtIsNull(userId)) {
      seenKeys.add(toDuplicateKey(entity));
    }

    List<TransactionEntity> toCreate = new ArrayList<>();
    List<CsvImportWarning> warnings = new ArrayList<>();
    List<FieldError> errors = new ArrayList<>();
    int skippedCount = 0;

    for (CsvRow row : parsedCsv.rows()) {
      try {
        ImportedRow imported = parseRow(row, headerIndexByName, mapping, accountNameMap);
        DuplicateKey key = imported.duplicateKey();
        if (seenKeys.contains(key)) {
          skippedCount += 1;
          continue;
        }

        seenKeys.add(key);
        warnings.addAll(imported.warnings());
        toCreate.add(toEntity(userId, imported));
      } catch (RowValidationException e) {
        errors.add(new FieldError("row[" + row.rowNumber() + "]", e.getMessage()));
      }
    }

    if (!errors.isEmpty()) {
      throw new RequestValidationException("CSV import failed.", errors);
    }

    transactionRepository.saveAll(toCreate);

    return new CsvImportResultResponse(
        toCreate.size(),
        skippedCount,
        warnings.size(),
        0,
        warnings);
  }

  private CsvImportMappingPayload parseMapping(String mappingJson) {
    if (mappingJson == null || mappingJson.trim().isEmpty()) {
      throw new RequestValidationException("CSV import failed.", List.of(new FieldError("mapping", "is required")));
    }

    try {
      return objectMapper.readValue(mappingJson, CsvImportMappingPayload.class);
    } catch (JsonProcessingException e) {
      throw new RequestValidationException("CSV import failed.", List.of(new FieldError("mapping", "must be valid JSON")));
    }
  }

  private void validateMapping(CsvImportMappingPayload mapping) {
    List<FieldError> errors = new ArrayList<>();

    if (mapping == null) {
      errors.add(new FieldError("mapping", "is required"));
    } else {
      if (mapping.columns() == null) {
        errors.add(new FieldError("mapping.columns", "is required"));
      } else {
        validateRequiredColumn(errors, "mapping.columns.txDate", mapping.columns().txDate());
        validateRequiredColumn(errors, "mapping.columns.amount", mapping.columns().amount());
        validateRequiredColumn(errors, "mapping.columns.description", mapping.columns().description());
        validateRequiredColumn(errors, "mapping.columns.account", mapping.columns().account());
      }

      if (mapping.accountNameMap() == null || mapping.accountNameMap().isEmpty()) {
        errors.add(new FieldError("mapping.accountNameMap", "must contain at least one mapped account"));
      }

      if (mapping.defaultType() == TransactionType.TRANSFER) {
        errors.add(new FieldError("mapping.defaultType", "TRANSFER import is not supported in MVP"));
      }
    }

    if (!errors.isEmpty()) {
      throw new RequestValidationException("CSV import failed.", errors);
    }
  }

  private void validateRequiredColumn(List<FieldError> errors, String field, String value) {
    if (value == null || value.trim().isEmpty()) {
      errors.add(new FieldError(field, "is required"));
    }
  }

  private ParsedCsv parseCsv(MultipartFile file) {
    final String content;
    try {
      content = new String(file.getBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new RequestValidationException("CSV import failed.", List.of(new FieldError("file", "could not be read")));
    }

    List<List<String>> rawRows = parseCsvRows(stripBom(content));
    List<List<String>> nonBlankRows = rawRows.stream()
        .filter((row) -> row.stream().anyMatch((cell) -> !cell.trim().isEmpty()))
        .toList();

    if (nonBlankRows.isEmpty()) {
      throw new RequestValidationException("CSV import failed.", List.of(new FieldError("file", "must not be empty")));
    }

    List<String> header = nonBlankRows.getFirst();
    if (header.stream().allMatch((cell) -> cell.trim().isEmpty())) {
      throw new RequestValidationException("CSV import failed.", List.of(new FieldError("file", "must contain a header row")));
    }

    List<CsvRow> rows = new ArrayList<>();
    for (int i = 1; i < nonBlankRows.size(); i++) {
      rows.add(new CsvRow(i + 1, nonBlankRows.get(i)));
    }

    if (rows.isEmpty()) {
      throw new RequestValidationException("CSV import failed.", List.of(new FieldError("file", "must contain at least one data row")));
    }

    return new ParsedCsv(header, rows);
  }

  private List<List<String>> parseCsvRows(String content) {
    List<List<String>> rows = new ArrayList<>();
    List<String> currentRow = new ArrayList<>();
    StringBuilder currentCell = new StringBuilder();
    boolean inQuotes = false;

    for (int i = 0; i < content.length(); i++) {
      char ch = content.charAt(i);

      if (ch == '"') {
        if (inQuotes && i + 1 < content.length() && content.charAt(i + 1) == '"') {
          currentCell.append('"');
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch == ',' && !inQuotes) {
        currentRow.add(currentCell.toString());
        currentCell.setLength(0);
        continue;
      }

      if ((ch == '\n' || ch == '\r') && !inQuotes) {
        if (ch == '\r' && i + 1 < content.length() && content.charAt(i + 1) == '\n') {
          i += 1;
        }
        currentRow.add(currentCell.toString());
        rows.add(currentRow);
        currentRow = new ArrayList<>();
        currentCell.setLength(0);
        continue;
      }

      currentCell.append(ch);
    }

    if (inQuotes) {
      throw new RequestValidationException("CSV import failed.", List.of(new FieldError("file", "contains an unclosed quoted field")));
    }

    if (!currentRow.isEmpty() || currentCell.length() > 0) {
      currentRow.add(currentCell.toString());
      rows.add(currentRow);
    }

    return rows;
  }

  private String stripBom(String value) {
    if (value.startsWith("\uFEFF")) {
      return value.substring(1);
    }
    return value;
  }

  private Map<String, Integer> headerIndexByName(List<String> header) {
    Map<String, Integer> indexes = new LinkedHashMap<>();
    for (int i = 0; i < header.size(); i++) {
      indexes.put(header.get(i).trim(), i);
    }
    return indexes;
  }

  private void validateHeaders(Map<String, Integer> headerIndexByName, CsvImportColumnMapping columns) {
    List<FieldError> errors = new ArrayList<>();
    validateHeader(errors, headerIndexByName, "mapping.columns.txDate", columns.txDate());
    validateHeader(errors, headerIndexByName, "mapping.columns.amount", columns.amount());
    validateHeader(errors, headerIndexByName, "mapping.columns.description", columns.description());
    validateHeader(errors, headerIndexByName, "mapping.columns.account", columns.account());

    if (columns.type() != null && !columns.type().trim().isEmpty() && !headerIndexByName.containsKey(columns.type().trim())) {
      errors.add(new FieldError("mapping.columns.type", "must match an existing CSV header"));
    }

    if (!errors.isEmpty()) {
      throw new RequestValidationException("CSV import failed.", errors);
    }
  }

  private void validateHeader(List<FieldError> errors, Map<String, Integer> headerIndexByName, String fieldName, String headerName) {
    if (!headerIndexByName.containsKey(headerName.trim())) {
      errors.add(new FieldError(fieldName, "must match an existing CSV header"));
    }
  }

  private Map<Long, AccountEntity> loadActiveAccounts(long userId) {
    Map<Long, AccountEntity> byId = new LinkedHashMap<>();
    for (AccountEntity account : accountRepository.findAllByUserIdOrderForList(userId)) {
      if (account.isActive()) {
        byId.put(account.getId(), account);
      }
    }
    return byId;
  }

  private Map<String, Long> normalizeAccountNameMap(Map<String, Long> raw, Map<Long, AccountEntity> activeAccountById) {
    Map<String, Long> normalized = new LinkedHashMap<>();
    List<FieldError> errors = new ArrayList<>();

    for (Map.Entry<String, Long> entry : raw.entrySet()) {
      String accountName = normalizeText(entry.getKey());
      Long accountId = entry.getValue();

      if (accountName.isEmpty()) {
        errors.add(new FieldError("mapping.accountNameMap", "contains a blank account name"));
        continue;
      }
      if (accountId == null || !activeAccountById.containsKey(accountId)) {
        errors.add(new FieldError("mapping.accountNameMap[" + entry.getKey() + "]", "must reference an active account owned by the current user"));
        continue;
      }

      normalized.put(accountName, accountId);
    }

    if (!errors.isEmpty()) {
      throw new RequestValidationException("CSV import failed.", errors);
    }

    return normalized;
  }

  private ImportedRow parseRow(
      CsvRow row,
      Map<String, Integer> headerIndexByName,
      CsvImportMappingPayload mapping,
      Map<String, Long> accountNameMap) {
    String rawDate = value(row.values(), headerIndexByName, mapping.columns().txDate());
    String rawAmount = value(row.values(), headerIndexByName, mapping.columns().amount());
    String rawDescription = value(row.values(), headerIndexByName, mapping.columns().description());
    String rawAccount = value(row.values(), headerIndexByName, mapping.columns().account());
    String rawType = optionalValue(row.values(), headerIndexByName, mapping.columns().type());

    LocalDate txDate = parseDate(rawDate);
    ParsedAmount parsedAmount = parseAmount(rawAmount);
    TransactionType type = resolveType(rawType, mapping.defaultType(), parsedAmount);
    Long accountId = resolveAccountId(rawAccount, accountNameMap);

    List<CsvImportWarning> warnings = new ArrayList<>();
    boolean needsReview = false;
    if (parsedAmount.inferredType() != null
        && parsedAmount.hadExplicitSign()
        && parsedAmount.inferredType() != type) {
      warnings.add(new CsvImportWarning(
          row.rowNumber(),
          "SIGN_TYPE_MISMATCH",
          "type and amount sign do not match; saved with needsReview=true"));
      needsReview = true;
    }

    TransactionDraft normalized = TransactionRuleValidator.sanitizeAndValidate(new TransactionDraft(
        type,
        parsedAmount.absoluteAmount(),
        accountId,
        null,
        null,
        null,
        needsReview,
        false));

    return new ImportedRow(
        txDate,
        normalized.type(),
        normalized.amount(),
        normalized.accountId(),
        normalizeDescription(rawDescription),
        normalized.needsReview(),
        normalized.excludeFromReports(),
        warnings);
  }

  private String value(List<String> rowValues, Map<String, Integer> headerIndexByName, String headerName) {
    Integer index = headerIndexByName.get(headerName.trim());
    if (index == null || index >= rowValues.size()) {
      return "";
    }
    return rowValues.get(index);
  }

  private String optionalValue(List<String> rowValues, Map<String, Integer> headerIndexByName, String headerName) {
    if (headerName == null || headerName.trim().isEmpty()) {
      return "";
    }
    Integer index = headerIndexByName.get(headerName.trim());
    if (index == null || index >= rowValues.size()) {
      return "";
    }
    return rowValues.get(index);
  }

  private LocalDate parseDate(String rawDate) {
    String value = rawDate == null ? "" : rawDate.trim();
    if (value.isEmpty()) {
      throw new RowValidationException("txDate is required");
    }

    for (DateTimeFormatter formatter : DATE_FORMATTERS) {
      try {
        return LocalDate.parse(value, formatter);
      } catch (DateTimeParseException ignored) {
      }
    }

    for (DateTimeFormatter formatter : DATE_TIME_FORMATTERS) {
      try {
        return LocalDateTime.parse(value, formatter).atZone(SEOUL).toLocalDate();
      } catch (DateTimeParseException ignored) {
      }
    }

    try {
      return OffsetDateTime.parse(value).atZoneSameInstant(SEOUL).toLocalDate();
    } catch (DateTimeParseException ignored) {
    }

    throw new RowValidationException("txDate has an unsupported date format");
  }

  private ParsedAmount parseAmount(String rawAmount) {
    String value = rawAmount == null ? "" : rawAmount.trim();
    if (value.isEmpty()) {
      throw new RowValidationException("amount is required");
    }

    boolean parenthesized = value.startsWith("(") && value.endsWith(")");
    String normalized = value
        .replace("₩", "")
        .replace("원", "")
        .replace(",", "")
        .replace("(", "")
        .replace(")", "")
        .trim();

    boolean negative = parenthesized || normalized.startsWith("-");
    boolean positive = normalized.startsWith("+");
    if (negative || positive) {
      normalized = normalized.substring(1).trim();
    }

    if (normalized.isEmpty()) {
      throw new RowValidationException("amount is required");
    }

    final long absoluteAmount;
    try {
      absoluteAmount = Math.abs(Long.parseLong(normalized));
    } catch (NumberFormatException e) {
      throw new RowValidationException("amount must be a KRW integer");
    }

    if (absoluteAmount <= 0) {
      throw new RowValidationException("amount must be positive");
    }

    TransactionType inferredType = negative ? TransactionType.EXPENSE : (positive ? TransactionType.INCOME : null);
    return new ParsedAmount(absoluteAmount, inferredType, negative || positive || parenthesized);
  }

  private TransactionType resolveType(String rawType, TransactionType defaultType, ParsedAmount amount) {
    String value = rawType == null ? "" : rawType.trim();
    if (!value.isEmpty()) {
      TransactionType explicitType;
      try {
        explicitType = TransactionType.valueOf(value.toUpperCase(Locale.ROOT));
      } catch (IllegalArgumentException e) {
        throw new RowValidationException("type must be INCOME or EXPENSE");
      }
      if (explicitType == TransactionType.TRANSFER) {
        throw new RowValidationException("TRANSFER import is not supported in MVP");
      }
      return explicitType;
    }

    if (defaultType != null) {
      if (defaultType == TransactionType.TRANSFER) {
        throw new RowValidationException("TRANSFER import is not supported in MVP");
      }
      return defaultType;
    }

    if (amount.inferredType() != null) {
      return amount.inferredType();
    }

    throw new RowValidationException("type is required when amount has no explicit sign");
  }

  private Long resolveAccountId(String rawAccount, Map<String, Long> accountNameMap) {
    String normalized = normalizeText(rawAccount);
    if (normalized.isEmpty()) {
      throw new RowValidationException("account is required");
    }
    Long accountId = accountNameMap.get(normalized);
    if (accountId == null) {
      throw new RowValidationException("account is not mapped to an active account");
    }
    return accountId;
  }

  private String normalizeDescription(String description) {
    if (description == null) {
      return "";
    }
    return description.trim();
  }

  private TransactionEntity toEntity(long userId, ImportedRow row) {
    TransactionEntity entity = new TransactionEntity();
    entity.setUserId(userId);
    entity.setTxDate(row.txDate());
    entity.setType(row.type());
    entity.setAmount(row.amount());
    entity.setAccountId(row.accountId());
    entity.setFromAccountId(null);
    entity.setToAccountId(null);
    entity.setDescription(row.description());
    entity.setCategoryId(null);
    entity.setNeedsReview(row.needsReview());
    entity.setExcludeFromReports(row.excludeFromReports());
    entity.setSource(SourceType.CSV);
    entity.setTagNames(Set.of());
    entity.setDeletedAt(null);
    return entity;
  }

  private DuplicateKey toDuplicateKey(TransactionEntity entity) {
    String accountKey = entity.getType() == TransactionType.TRANSFER
        ? "TRANSFER:" + entity.getFromAccountId() + ":" + entity.getToAccountId()
        : "ACCOUNT:" + entity.getAccountId();
    return new DuplicateKey(
        entity.getTxDate(),
        entity.getType(),
        entity.getAmount(),
        accountKey,
        normalizeText(entity.getDescription()));
  }

  private String normalizeText(String value) {
    if (value == null) {
      return "";
    }
    return WHITESPACE.matcher(value.trim()).replaceAll(" ").toLowerCase(Locale.ROOT);
  }

  private long currentUserId() {
    Authentication authentication = Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
        .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Unauthorized."));
    Object principal = authentication.getPrincipal();
    if (principal instanceof AuthUserPrincipal p) {
      return p.userId();
    }
    if (principal instanceof AuthUserDetails d) {
      return d.userId();
    }
    throw new ResponseStatusException(UNAUTHORIZED, "Unauthorized.");
  }

  private record ParsedCsv(List<String> header, List<CsvRow> rows) {
  }

  private record CsvRow(int rowNumber, List<String> values) {
  }

  private record ParsedAmount(long absoluteAmount, TransactionType inferredType, boolean hadExplicitSign) {
  }

  private record ImportedRow(
      LocalDate txDate,
      TransactionType type,
      long amount,
      Long accountId,
      String description,
      boolean needsReview,
      boolean excludeFromReports,
      List<CsvImportWarning> warnings
  ) {
    private DuplicateKey duplicateKey() {
      return new DuplicateKey(txDate, type, amount, "ACCOUNT:" + accountId, normalizeKeyDescription(description));
    }
  }

  private record DuplicateKey(
      LocalDate txDate,
      TransactionType type,
      long amount,
      String accountKey,
      String descriptionNormalized
  ) {
  }

  private static String normalizeKeyDescription(String description) {
    if (description == null) {
      return "";
    }
    return WHITESPACE.matcher(description.trim()).replaceAll(" ").toLowerCase(Locale.ROOT);
  }

  private static final class RowValidationException extends RuntimeException {
    private RowValidationException(String message) {
      super(message);
    }
  }
}
