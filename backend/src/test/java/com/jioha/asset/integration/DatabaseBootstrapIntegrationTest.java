package com.jioha.asset.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class DatabaseBootstrapIntegrationTest {

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("asset_db")
          .withUsername("asset")
          .withPassword("asset");

  @DynamicPropertySource
  static void configureDatasource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.session.jdbc.initialize-schema", () -> "never");
  }

  @Autowired
  JdbcTemplate jdbcTemplate;

  @Test
  void flyway_and_session_schema_are_bootstrapped_in_postgres() {
    assertTableExists("users");
    assertTableExists("accounts");
    assertTableExists("transactions");
    assertTableExists("spring_session");
    assertTableExists("spring_session_attributes");

    Integer successfulMigrations = jdbcTemplate.queryForObject(
        "select count(*) from flyway_schema_history where success = true",
        Integer.class
    );

    assertThat(successfulMigrations).isNotNull();
    assertThat(successfulMigrations).isGreaterThanOrEqualTo(2);
  }

  private void assertTableExists(String tableName) {
    Integer count = jdbcTemplate.queryForObject(
        "select count(*) from information_schema.tables where table_schema = 'public' and table_name = ?",
        Integer.class,
        tableName
    );

    assertThat(count).isEqualTo(1);
  }
}
