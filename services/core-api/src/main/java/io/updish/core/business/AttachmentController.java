package io.updish.core.business;

import io.updish.core.auth.WalletPrincipal;
import static io.updish.core.business.WorkbenchService.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.*;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;

@RestController
@RequestMapping("/api/v1/workbench/attachments")
public class AttachmentController {
    private final WorkbenchService work;private final JdbcTemplate db;private final String bucket;private final Region region;
    public AttachmentController(WorkbenchService work,JdbcTemplate db,@Value("${S3_BUCKET:}") String bucket,@Value("${AWS_REGION:ap-northeast-2}") String region) {this.work=work;this.db=db;this.bucket=bucket;this.region=Region.of(region);}
    public record Upload(UUID offeringId,String filename,String contentType,long sizeBytes) {}
    private void configured() {if(bucket.isBlank()) throw new BusinessFailure("STORAGE_NOT_CONFIGURED",503,"비공개 S3 보관함이 아직 연결되지 않았습니다.");}
    private Map<String,Object> accessible(WalletPrincipal a,UUID id) {var attachment=work.one("SELECT * FROM evidence_attachment WHERE id=?",id);var o=work.one("SELECT * FROM offering WHERE id=?",uuid(attachment,"offering_id"));work.requireManager(a,o);return attachment;}
    @PostMapping("/upload-url") Object upload(@AuthenticationPrincipal WalletPrincipal a,@RequestBody Upload b) {
        configured();if(b.offeringId()==null||b.sizeBytes()<1||b.sizeBytes()>5_242_880||b.filename()==null||!b.filename().matches("[\\p{L}\\p{N}_. -]{1,120}")||!Set.of("application/pdf","image/png","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").contains(b.contentType())) throw BusinessFailure.invalid("PDF·PNG·XLSX 증빙은 5MB 이하로 제출해 주세요.");
        if(!(b.contentType().equals("application/pdf")&&b.filename().toLowerCase().endsWith(".pdf")||b.contentType().equals("image/png")&&b.filename().toLowerCase().endsWith(".png")||b.contentType().contains("spreadsheet")&&b.filename().toLowerCase().endsWith(".xlsx"))) throw BusinessFailure.invalid("파일 확장자와 형식이 일치하지 않습니다.");
        var o=work.one("SELECT * FROM offering WHERE id=? AND run_id=?",b.offeringId(),work.runId());if(!a.address().equals(o.get("owner_address"))&&!"OPERATOR".equals(work.role(a))) throw BusinessFailure.forbidden();
        var id=UUID.randomUUID();var key="demo/"+work.runId()+"/"+id;
        try(var signer=S3Presigner.builder().region(region).build()) {
            var presigned=signer.presignPutObject(PutObjectPresignRequest.builder().signatureDuration(Duration.ofMinutes(5)).putObjectRequest(PutObjectRequest.builder().bucket(bucket).key(key).contentType(b.contentType()).contentLength(b.sizeBytes()).build()).build());
            db.update("INSERT INTO evidence_attachment(id,offering_id,uploaded_by,object_key,filename,content_type,size_bytes,status) VALUES (?,?,?,?,?,?,?,'PENDING')",id,b.offeringId(),a.address(),key,b.filename(),b.contentType(),b.sizeBytes());
            var headers=new HashMap<String,String>();presigned.signedHeaders().forEach((k,v)->{if(!Set.of("host","content-length").contains(k)) headers.put(k,String.join(",",v));});return Map.of("id",id,"url",presigned.url().toString(),"headers",headers,"expiresInSeconds",300);
        }
    }
    @PostMapping("/{id}/complete") Object complete(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {
        configured();var attachment=accessible(a,id);
        try(var s3=S3Client.builder().region(region).httpClientBuilder(UrlConnectionHttpClient.builder()).build()) {
            var head=s3.headObject(HeadObjectRequest.builder().bucket(bucket).key(attachment.get("object_key").toString()).build());
            if(head.contentLength()!=number(attachment,"size_bytes")||!head.contentType().equals(attachment.get("content_type"))) throw BusinessFailure.conflict("업로드된 파일의 크기 또는 형식이 일치하지 않습니다.");
            db.update("UPDATE evidence_attachment SET status='READY' WHERE id=?",id);return Map.of("id",id,"status","READY");
        } catch(S3Exception e) {throw new BusinessFailure("STORAGE_CHECK_FAILED",503,"업로드 완료를 확인하지 못했습니다.");}
    }
    @GetMapping("/{id}/download-url") Object download(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {
        configured();var attachment=accessible(a,id);if(!attachment.get("status").equals("READY")) throw BusinessFailure.conflict("검증된 업로드만 다운로드할 수 있습니다.");
        try(var signer=S3Presigner.builder().region(region).build()) {
            var url=signer.presignGetObject(GetObjectPresignRequest.builder().signatureDuration(Duration.ofMinutes(2)).getObjectRequest(GetObjectRequest.builder().bucket(bucket).key(attachment.get("object_key").toString()).responseContentDisposition("attachment").build()).build());return Map.of("url",url.url().toString(),"expiresInSeconds",120);
        }
    }
    @GetMapping Object list(@AuthenticationPrincipal WalletPrincipal a) {var o=work.offering();work.requireManager(a,o);return work.rows("SELECT id,filename,content_type,size_bytes,status,created_at FROM evidence_attachment WHERE offering_id=?",uuid(o,"id"));}
}
