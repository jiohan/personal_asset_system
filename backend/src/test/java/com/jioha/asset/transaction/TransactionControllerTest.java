package com.jioha.asset.transaction;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.hamcrest.Matchers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
class TransactionControllerTest {

  @Autowired
  MockMvc mvc;

  @Autowired
  ObjectMapper objectMapper;

  @Test
  void create_list_get_patch_delete_and_softDelete_exclusion() throws Exception {
    SessionContext me = signupAndLogin();
    long accountId = createAccount(me, "Main", "CHECKING", true);
    long categoryId = createCategory(me, "EXPENSE", "Food");

    long txId = createTransaction(me, Map.of(
        "txDate", "2026-03-01",
        "type", "EXPENSE",
        "amount", 12000,
        "accountId", accountId,
        "categoryId", categoryId,
        "description", "Lunch",
        "excludeFromReports", true
    ));

    mvc.perform(get("/api/v1/transactions")
            .cookie(me.sessionCookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].id").value(txId))
        .andExpect(jsonPath("$.items[0].excludeFromReports").value(true));

    mvc.perform(get("/api/v1/accounts")
            .cookie(me.sessionCookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].currentBalance").value(-12000));

    mvc.perform(get("/api/v1/transactions/{id}", txId)
            .cookie(me.sessionCookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.description").value("Lunch"));

    mvc.perform(patch("/api/v1/transactions/{id}", txId)
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "amount", 15000,
                "description", "Late lunch"
            ))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.amount").value(15000))
        .andExpect(jsonPath("$.description").value("Late lunch"));

    mvc.perform(patch("/api/v1/transactions/{id}", txId)
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "clearCategory", true,
                "needsReview", false
            ))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.categoryId").value(Matchers.nullValue()))
        .andExpect(jsonPath("$.needsReview").value(true));

    mvc.perform(delete("/api/v1/transactions/{id}", txId)
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf))
        .andExpect(status().isNoContent());

    mvc.perform(get("/api/v1/transactions")
            .cookie(me.sessionCookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(0));

    mvc.perform(get("/api/v1/accounts")
            .cookie(me.sessionCookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].currentBalance").value(0));

    mvc.perform(get("/api/v1/transactions/{id}", txId)
            .cookie(me.sessionCookie))
        .andExpect(status().isNotFound());
  }

  @Test
  void create_income_withExcludeFromReports_true_isForcedFalse() throws Exception {
    SessionContext me = signupAndLogin();
    long accountId = createAccount(me, "IncomeAccount", "CHECKING", true);

    long txId = createTransaction(me, Map.of(
        "txDate", "2026-03-01",
        "type", "INCOME",
        "amount", 50000,
        "accountId", accountId,
        "excludeFromReports", true
    ));

    mvc.perform(get("/api/v1/transactions/{id}", txId)
            .cookie(me.sessionCookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.excludeFromReports").value(false));
  }

  @Test
  void create_withInactiveAccount_validationError() throws Exception {
    SessionContext me = signupAndLogin();
    long accountId = createAccount(me, "Inactive", "CHECKING", false);

    mvc.perform(post("/api/v1/transactions")
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "txDate", "2026-03-01",
                "type", "EXPENSE",
                "amount", 1000,
                "accountId", accountId
            ))))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
  }

  @Test
  void create_withInactiveCategory_returnsConflict() throws Exception {
    SessionContext me = signupAndLogin();
    long accountId = createAccount(me, "Main", "CHECKING", true);
    long categoryId = createCategory(me, "EXPENSE", "Dormant");

    mvc.perform(patch("/api/v1/categories/{id}", categoryId)
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of("isActive", false))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.isActive").value(false));

    mvc.perform(post("/api/v1/transactions")
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "txDate", "2026-03-01",
                "type", "EXPENSE",
                "amount", 1000,
                "accountId", accountId,
                "categoryId", categoryId
            ))))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.error.code").value("CONFLICT"));
  }

  @Test
  void create_transfer_beforeSlice4_returnsConflict() throws Exception {
    SessionContext me = signupAndLogin();

    mvc.perform(post("/api/v1/transactions")
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "txDate", "2026-03-01",
                "type", "TRANSFER",
                "amount", 1000,
                "fromAccountId", 1,
                "toAccountId", 2
            ))))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.error.code").value("CONFLICT"));
  }

  @Test
  void get_othersTransaction_returnsNotFound() throws Exception {
    SessionContext owner = signupAndLogin();
    SessionContext other = signupAndLogin();
    long accountId = createAccount(owner, "OwnerAccount", "CHECKING", true);
    long txId = createTransaction(owner, Map.of(
        "txDate", "2026-03-01",
        "type", "EXPENSE",
        "amount", 2200,
        "accountId", accountId
    ));

    mvc.perform(get("/api/v1/transactions/{id}", txId)
            .cookie(other.sessionCookie))
        .andExpect(status().isNotFound());
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
