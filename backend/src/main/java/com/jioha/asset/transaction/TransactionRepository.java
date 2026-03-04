package com.jioha.asset.transaction;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransactionRepository extends JpaRepository<TransactionEntity, Long>, JpaSpecificationExecutor<TransactionEntity> {

  Optional<TransactionEntity> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

  @Query(value = """
      select a.id as accountId,
             a.opening_balance + coalesce(sum(
               case
                 when t.type = 'INCOME' and t.account_id = a.id then t.amount
                 when t.type = 'EXPENSE' and t.account_id = a.id then -t.amount
                 when t.type = 'TRANSFER' and t.to_account_id = a.id then t.amount
                 when t.type = 'TRANSFER' and t.from_account_id = a.id then -t.amount
                 else 0
               end
             ), 0) as currentBalance
      from accounts a
      left join transactions t
        on t.user_id = a.user_id
       and t.deleted_at is null
       and (
          t.account_id = a.id
          or t.from_account_id = a.id
          or t.to_account_id = a.id
       )
      where a.user_id = :userId
      group by a.id, a.opening_balance
      """, nativeQuery = true)
  List<AccountBalanceProjection> findCurrentBalancesByUserId(@Param("userId") Long userId);
}
