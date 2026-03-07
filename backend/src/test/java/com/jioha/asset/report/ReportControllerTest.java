package com.jioha.asset.report;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "spring.flyway.enabled=false",
    "spring.datasource.url=jdbc:h2:mem:asset_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driverClassName=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.session.store-type=jdbc",
    "spring.session.jdbc.initialize-schema=always"
})
@AutoConfigureMockMvc
class ReportControllerTest {

  @Autowired
  MockMvc mvc;

  @Autowired
  ObjectMapper objectMapper;

  @Test
  void summary_excludes_excludedExpenses_and_counts_transfers_as_transferVolume() throws Exception {
    SessionContext me = signupAndLogin();

    long checking = createAccount(me, "Checking", "CHECKING", true);
    long savings = createAccount(me, "Savings", "SAVINGS", true);
    long food = createCategory(me, "EXPENSE", "Food");

    createTransaction(me, Map.of(
        "txDate", "2026-03-01",
        "type", "INCOME",
        "amount", 1000,
        "accountId", checking,
        "description", "Salary"
    ));
    createTransaction(me, Map.of(
        "txDate", "2026-03-15",
        "type", "EXPENSE",
        "amount", 400,
        "accountId", checking,
        "categoryId", food,
        "description", "Meal"
    ));

    long deletedExpenseId = createTransaction(me, Map.of(
        "txDate", "2026-03-20",
        "type", "EXPENSE",
        "amount", 123,
        "accountId", checking,
        "categoryId", food,
        "description", "Deleted"
    ));
    deleteTransaction(me, deletedExpenseId);
    createTransaction(me, Map.of(
        "txDate", "2026-03-31",
        "type", "EXPENSE",
        "amount", 50,
        "accountId", checking,
        "categoryId", food,
        "excludeFromReports", true,
        "description", "Excluded"
    ));
    createTransaction(me, Map.of(
        "txDate", "2026-03-31",
        "type", "TRANSFER",
        "amount", 200,
        "fromAccountId", checking,
        "toAccountId", savings,
        "description", "Move"
    ));

    SessionContext other = signupAndLogin();
    long otherAccount = createAccount(other, "Other", "CHECKING", true);
    createTransaction(other, Map.of(
        "txDate", "2026-03-10",
        "type", "INCOME",
        "amount", 999999,
        "accountId", otherAccount
    ));

    mvc.perform(get("/api/v1/reports/summary")
            .cookie(me.sessionCookie)
            .queryParam("from", "2026-03-01")
            .queryParam("to", "2026-03-31"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.from").value("2026-03-01"))
        .andExpect(jsonPath("$.to").value("2026-03-31"))
        .andExpect(jsonPath("$.totalIncome").value(1000))
        .andExpect(jsonPath("$.totalExpense").value(400))
        .andExpect(jsonPath("$.netSaving").value(600))
        .andExpect(jsonPath("$.transferVolume").value(200));
  }

  @Test
  void transfers_groups_by_account_pair_and_sums_amounts() throws Exception {
    SessionContext me = signupAndLogin();

    long from = createAccount(me, "From", "CHECKING", true);
    long to = createAccount(me, "To", "SAVINGS", true);

    createTransaction(me, Map.of(
        "txDate", "2026-03-01",
        "type", "TRANSFER",
        "amount", 300,
        "fromAccountId", from,
        "toAccountId", to
    ));
    createTransaction(me, Map.of(
        "txDate", "2026-03-02",
        "type", "TRANSFER",
        "amount", 200,
        "fromAccountId", from,
        "toAccountId", to
    ));
    createTransaction(me, Map.of(
        "txDate", "2026-03-03",
        "type", "TRANSFER",
        "amount", 100,
        "fromAccountId", to,
        "toAccountId", from
    ));

    mvc.perform(get("/api/v1/reports/transfers")
            .cookie(me.sessionCookie)
            .queryParam("from", "2026-03-01")
            .queryParam("to", "2026-03-31"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.from").value("2026-03-01"))
        .andExpect(jsonPath("$.to").value("2026-03-31"))
        .andExpect(jsonPath("$.items.length()").value(2))
        .andExpect(jsonPath("$.items[0].fromAccountId").value(from))
        .andExpect(jsonPath("$.items[0].toAccountId").value(to))
        .andExpect(jsonPath("$.items[0].amount").value(500))
        .andExpect(jsonPath("$.items[1].fromAccountId").value(to))
        .andExpect(jsonPath("$.items[1].toAccountId").value(from))
        .andExpect(jsonPath("$.items[1].amount").value(100));
  }

  @Test
  void reports_to_before_from_returnsValidationError() throws Exception {
    SessionContext me = signupAndLogin();

    mvc.perform(get("/api/v1/reports/summary")
            .cookie(me.sessionCookie)
            .queryParam("from", "2026-03-02")
            .queryParam("to", "2026-03-01"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
        .andExpect(jsonPath("$.error.fieldErrors[?(@.field=='to')].reason")
            .value(Matchers.hasItem(Matchers.containsString("on or after"))));
  }

  private long createAccount(SessionContext session, String name, String type, boolean isActive) throws Exception {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("name", name);
    payload.put("type", type);
    payload.put("openingBalance", 0);
    payload.put("isActive", isActive);

    MvcResult res = mvc.perform(post("/api/v1/accounts")
            .cookie(session.sessionCookie, session.xsrfCookie)
            .header("X-XSRF-TOKEN", session.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(payload)))
        .andExpect(status().isCreated())
        .andReturn();

    return objectMapper.readTree(res.getResponse().getContentAsString()).path("id").asLong();
  }

  private long createCategory(SessionContext session, String type, String name) throws Exception {
    MvcResult res = mvc.perform(post("/api/v1/categories")
            .cookie(session.sessionCookie, session.xsrfCookie)
            .header("X-XSRF-TOKEN", session.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "type", type,
                "name", name
            ))))
        .andExpect(status().isCreated())
        .andReturn();

    return objectMapper.readTree(res.getResponse().getContentAsString()).path("id").asLong();
  }

  private long createTransaction(SessionContext session, Map<String, Object> payload) throws Exception {
    MvcResult res = mvc.perform(post("/api/v1/transactions")
            .cookie(session.sessionCookie, session.xsrfCookie)
            .header("X-XSRF-TOKEN", session.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(payload)))
        .andExpect(status().isCreated())
        .andReturn();

    return objectMapper.readTree(res.getResponse().getContentAsString()).path("id").asLong();
  }

  private void deleteTransaction(SessionContext session, long id) throws Exception {
    mvc.perform(delete("/api/v1/transactions/{id}", id)
            .cookie(session.sessionCookie, session.xsrfCookie)
            .header("X-XSRF-TOKEN", session.xsrf))
        .andExpect(status().isNoContent());
  }

  private SessionContext signupAndLogin() throws Exception {
    String email = "u-" + UUID.randomUUID() + "@example.com";
    String password = "demo-password";

    MvcResult csrf = mvc.perform(get("/api/v1/auth/csrf"))
        .andExpect(status().isNoContent())
        .andReturn();

    String xsrf = csrf.getResponse().getCookie("XSRF-TOKEN").getValue();
    jakarta.servlet.http.Cookie xsrfCookie = new jakarta.servlet.http.Cookie("XSRF-TOKEN", xsrf);

    MvcResult signup = mvc.perform(post("/api/v1/auth/signup")
            .header("X-XSRF-TOKEN", xsrf)
            .cookie(xsrfCookie)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", password
            ))))
        .andExpect(status().isCreated())
        .andReturn();

    jakarta.servlet.http.Cookie sessionCookie =
        new jakarta.servlet.http.Cookie("JSESSIONID", signup.getResponse().getCookie("JSESSIONID").getValue());

    return new SessionContext(sessionCookie, xsrfCookie, xsrf);
  }

  private record SessionContext(
      jakarta.servlet.http.Cookie sessionCookie,
      jakarta.servlet.http.Cookie xsrfCookie,
      String xsrf
  ) {
  }
}
