package com.jioha.asset.csvimport;

import jakarta.validation.constraints.NotBlank;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/imports")
public class CsvImportController {

  private final CsvImportService csvImportService;

  public CsvImportController(CsvImportService csvImportService) {
    this.csvImportService = csvImportService;
  }

  @PostMapping(path = "/csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<CsvImportResultResponse> importCsv(
      @RequestParam MultipartFile file,
      @RequestParam @NotBlank String mapping) {
    return ResponseEntity.status(201).body(csvImportService.importCsv(file, mapping));
  }
}
