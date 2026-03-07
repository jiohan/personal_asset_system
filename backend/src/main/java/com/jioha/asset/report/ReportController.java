package com.jioha.asset.report;

import java.time.LocalDate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {

  private final ReportService reportService;

  public ReportController(ReportService reportService) {
    this.reportService = reportService;
  }

  @GetMapping("/summary")
  public ReportSummaryResponse summary(
      @RequestParam LocalDate from,
      @RequestParam LocalDate to) {
    return reportService.summary(from, to);
  }

  @GetMapping("/transfers")
  public TransferReportResponse transfers(
      @RequestParam LocalDate from,
      @RequestParam LocalDate to) {
    return reportService.transfers(from, to);
  }
}
