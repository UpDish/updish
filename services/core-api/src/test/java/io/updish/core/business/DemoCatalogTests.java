package io.updish.core.business;

import static org.junit.jupiter.api.Assertions.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class DemoCatalogTests {
    @Test void everyPublishedScenarioMatchesCoreReconciliationAndExactSourceHash() throws Exception {
        try(var stream=getClass().getResourceAsStream("/catalog.json")) {
            var catalog=new ObjectMapper().readTree(stream);
            assertEquals("SIMULATION",catalog.get("mode").asText());assertEquals(9,catalog.get("scenarios").size());
            var ids=new HashSet<String>();
            for(var s:catalog.get("scenarios")) {
                assertTrue(ids.add(s.get("id").asText()));
                byte[] bytes;try(var csv=getClass().getResourceAsStream("/"+s.get("filename").asText())){bytes=csv.readAllBytes();}
                assertEquals(s.get("sha256").asText(),HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)));
                var report=CsvReconciliation.reconcile(new String(bytes,StandardCharsets.UTF_8),s.get("period").asText());
                assertEquals(s.get("expectedNetWon").asText(),report.netWon());assertEquals(s.get("ready").asBoolean(),report.ready());
                var expected=new HashSet<String>();for(var code:s.get("expectedIssueCodes"))expected.add(code.asText());
                assertEquals(expected,new HashSet<>(report.issues().stream().map(CsvReconciliation.Issue::code).toList()));
            }
        }
    }
    @Test void historyAndExceptionScenariosKeepDifferentDemonstrationMeanings() throws Exception {
        try(var stream=getClass().getResourceAsStream("/catalog.json")) {
            var catalog=new ObjectMapper().readTree(stream);var months=new TreeSet<String>();
            for(var s:catalog.get("scenarios"))if(s.get("history").asBoolean()){assertTrue(s.get("ready").asBoolean());assertTrue(months.add(s.get("period").asText()));}
            assertEquals(new TreeSet<>(List.of("2026-05","2026-06","2026-07","2026-08","2026-09","2026-10")),months);
            var shortage=CsvReconciliation.reconcile(CsvReconciliationTests.fixture("cash-shortage"),"2026-11");
            assertEquals(720000,SettlementMath.pool(Long.parseLong(shortage.netWon()),300));assertEquals(300000,SettlementMath.cash(Long.parseLong(shortage.netWon())));
            var normal=CsvReconciliation.reconcile(CsvReconciliationTests.fixture("normal"),"2026-10");var corrected=CsvReconciliation.reconcile(CsvReconciliationTests.fixture("correction"),"2026-10");
            assertEquals(1000000,Long.parseLong(normal.netWon())-Long.parseLong(corrected.netWon()));
        }
    }
}
