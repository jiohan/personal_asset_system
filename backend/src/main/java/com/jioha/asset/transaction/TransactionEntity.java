package com.jioha.asset.transaction;

import com.jioha.asset.domain.TransactionType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "transactions")
public class TransactionEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(name = "tx_date", nullable = false)
  private LocalDate txDate;

  @Enumerated(EnumType.STRING)
  @Column(name = "type", nullable = false, length = 20)
  private TransactionType type;

  @Column(name = "amount", nullable = false)
  private long amount;

  @Column(name = "account_id")
  private Long accountId;

  @Column(name = "from_account_id")
  private Long fromAccountId;

  @Column(name = "to_account_id")
  private Long toAccountId;

  @Column(name = "description", nullable = false, length = 255)
  private String description;

  @Column(name = "category_id")
  private Long categoryId;

  @Column(name = "needs_review", nullable = false)
  private boolean needsReview;

  @Column(name = "exclude_from_reports", nullable = false)
  private boolean excludeFromReports;

  @Enumerated(EnumType.STRING)
  @Column(name = "source", nullable = false, length = 20)
  private SourceType source;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private Instant updatedAt;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "transaction_tags", joinColumns = @JoinColumn(name = "transaction_id"))
  @Column(name = "tag_name", nullable = false, length = 30)
  private Set<String> tagNames = new LinkedHashSet<>();

  public Long getId() {
    return id;
  }

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }

  public LocalDate getTxDate() {
    return txDate;
  }

  public void setTxDate(LocalDate txDate) {
    this.txDate = txDate;
  }

  public TransactionType getType() {
    return type;
  }

  public void setType(TransactionType type) {
    this.type = type;
  }

  public long getAmount() {
    return amount;
  }

  public void setAmount(long amount) {
    this.amount = amount;
  }

  public Long getAccountId() {
    return accountId;
  }

  public void setAccountId(Long accountId) {
    this.accountId = accountId;
  }

  public Long getFromAccountId() {
    return fromAccountId;
  }

  public void setFromAccountId(Long fromAccountId) {
    this.fromAccountId = fromAccountId;
  }

  public Long getToAccountId() {
    return toAccountId;
  }

  public void setToAccountId(Long toAccountId) {
    this.toAccountId = toAccountId;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public Long getCategoryId() {
    return categoryId;
  }

  public void setCategoryId(Long categoryId) {
    this.categoryId = categoryId;
  }

  public boolean isNeedsReview() {
    return needsReview;
  }

  public void setNeedsReview(boolean needsReview) {
    this.needsReview = needsReview;
  }

  public boolean isExcludeFromReports() {
    return excludeFromReports;
  }

  public void setExcludeFromReports(boolean excludeFromReports) {
    this.excludeFromReports = excludeFromReports;
  }

  public SourceType getSource() {
    return source;
  }

  public void setSource(SourceType source) {
    this.source = source;
  }

  public Instant getDeletedAt() {
    return deletedAt;
  }

  public void setDeletedAt(Instant deletedAt) {
    this.deletedAt = deletedAt;
  }

  public Set<String> getTagNames() {
    return tagNames;
  }

  public void setTagNames(Set<String> tagNames) {
    this.tagNames = tagNames;
  }
}
