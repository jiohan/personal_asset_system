package com.jioha.asset.csvimport;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "spring.flyway.enabled=false",
    "spring.datasource.url=jdbc:h2:mem:asset_test_csv_import;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driverClassName=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.session.store-type=jdbc",
    "spring.session.jdbc.initialize-schema=always"
})
@AutoConfigureMockMvc
class CsvImportControllerTest {

  @Autowired
  MockMvc mvc;

  @Autowired
  ObjectMapper objectMapper;

  @Test
  void importCsv_skipsDuplicates_and_marksImportedRowsAsCsvNeedsReview() throws Exception {
    SessionContext me = signupAndLogin();
    long accountId = createAccount(me, "Main", "CHECKING");

    createTransaction(me, Map.of(
        "txDate", "2026-03-01",
        "type", "EXPENSE",
        "amount", 12500,
        "accountId", accountId,
        "description", "Coffee"
    ));

    String csv = """
        Date,Amount,Description,Account,Type
        2026-03-01,"12,500",Coffee,Main,EXPENSE
        2026-03-02,3000,Taxi,Main,EXPENSE
        """;

    MockMultipartFile file = new MockMultipartFile(
        "file",
        "sample.csv",
        "text/csv",
        csv.getBytes(StandardCharsets.UTF_8));

    String mapping = objectMapper.writeValueAsString(Map.of(
        "columns", Map.of(
            "txDate", "Date",
            "amount", "Amount",
            "description", "Description",
            "account", "Account",
            "type", "Type"
        ),
        "accountNameMap", Map.of("Main", accountId),
        "defaultType", "EXPENSE"
    ));

    mvc.perform(multipart("/api/v1/imports/csv")
            .file(file)
            .param("mapping", mapping)
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.createdCount").value(1))
        .andExpect(jsonPath("$.skippedCount").value(1))
        .andExpect(jsonPath("$.warningCount").value(0))
        .andExpect(jsonPath("$.errorCount").value(0));

    mvc.perform(get("/api/v1/transactions")
            .cookie(me.sessionCookie)
            .queryParam("q", "Taxi"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items", hasSize(1)))
        .andExpect(jsonPath("$.items[0].description").value("Taxi"))
        .andExpect(jsonPath("$.items[0].source").value("CSV"))
        .andExpect(jsonPath("$.items[0].needsReview").value(true));
  }

  @Test
  void importCsv_withInvalidDate_rollsBackEntireBatch() throws Exception {
    SessionContext me = signupAndLogin();
    long accountId = createAccount(me, "Main", "CHECKING");

    String csv = """
        Date,Amount,Description,Account,Type
        2026-03-01,12000,Lunch,Main,EXPENSE
        bad-date,5000,Taxi,Main,EXPENSE
        """;

    MockMultipartFile file = new MockMultipartFile(
        "file",
        "invalid.csv",
        "text/csv",
        csv.getBytes(StandardCharsets.UTF_8));

    String mapping = objectMapper.writeValueAsString(Map.of(
        "columns", Map.of(
            "txDate", "Date",
            "amount", "Amount",
            "description", "Description",
            "account", "Account",
            "type", "Type"
        ),
        "accountNameMap", Map.of("Main", accountId),
        "defaultType", "EXPENSE"
    ));

    mvc.perform(multipart("/api/v1/imports/csv")
            .file(file)
            .param("mapping", mapping)
            .cookie(me.sessionCookie, me.xsrfCookie)
            .header("X-XSRF-TOKEN", me.xsrf))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
        .andExpect(jsonPath("$.error.fieldErrors[*].field", hasItem("row[3]")));

    mvc.perform(get("/api/v1/transactions")
            .cookie(me.sessionCookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items", hasSize(0)));
  }

  private long createAccount(SessionContext session, String name, String type) throws Exception {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("name", name);
    payload.put("type", type);
    payload.put("openingBalance", 0);
    payload.put("isActive", true);

    MvcResult res = mvc.perform(post("/api/v1/accounts")
            .cookie(session.sessionCookie, session.xsrfCookie)
            .header("X-XSRF-TOKEN", session.xsrf)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(payload)))
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
