package io.updish.core.chain;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class GiwaServiceTests {
    final RpcClient rpc = mock(RpcClient.class);
    final GiwaService service = new GiwaService(rpc);
    final String address = "0x0000000000000000000000000000000000000001";

    @BeforeEach
    void network() {
        when(rpc.call("eth_chainId", List.of())).thenReturn("0x164ce");
        when(rpc.call("eth_getBlockByNumber", List.of("safe", false))).thenReturn(Map.of("number", "0x10"));
        when(rpc.call(eq("eth_getCode"), anyList())).thenReturn("0x6000");
    }

    @Test
    void outageMustNeverBecomeAnUnverifiedWallet() {
        when(rpc.call(eq("eth_call"), anyList())).thenThrow(new ChainFailure("RPC_UNAVAILABLE"));
        assertThatThrownBy(() -> service.verify(address)).isInstanceOf(ChainFailure.class);
    }

    @Test
    void wrongChainAndMissingContractAreRejectedBeforeAttestationRead() {
        when(rpc.call("eth_chainId", List.of())).thenReturn("0x1");
        assertThatThrownBy(service::network).isInstanceOf(ChainFailure.class);
        verify(rpc, never()).call(eq("eth_call"), anyList());
    }

    @Test
    void missingBytecodeIsRejected() {
        when(rpc.call(eq("eth_getCode"), anyList())).thenReturn("0x");
        assertThatThrownBy(service::network).isInstanceOf(ChainFailure.class);
    }

    @Test
    void unverifiedWalletDoesNotCallTheRevertingUidGetter() {
        when(rpc.call(eq("eth_call"), anyList())).thenReturn("0x" + "0".repeat(64));
        var result = service.verify(address);
        assertThat(result.status()).isEqualTo("NOT_VERIFIED");
        assertThat(result.attester()).isEqualTo("TESTNET FAUCET");
        assertThat(result.attestationUid()).isNull();
        verify(rpc, times(1)).call(eq("eth_call"), argThat(params -> params.get(1).equals("0x10")));
    }

    @Test
    void verifiedWalletAndUidUseOneBlock() {
        when(rpc.call(eq("eth_call"), anyList())).thenReturn("0x" + "0".repeat(63) + "1",
                "0x" + "f".repeat(64));
        var result = service.verify(address);
        assertThat(result.status()).isEqualTo("VERIFIED_TESTNET");
        verify(rpc, times(2)).call(eq("eth_call"), argThat(params -> params.get(1).equals("0x10")));
    }

    @Test
    void malformedBooleanIsNotInterpretedAsFalse() {
        assertThatThrownBy(() -> DojangCodec.bool("0x" + "0".repeat(63) + "2"))
                .isInstanceOf(ChainFailure.class);
        assertThatThrownBy(() -> DojangCodec.bool("0x")).isInstanceOf(ChainFailure.class);
    }

    @Test
    void verificationWithoutAnAttestationUidIsRejected() {
        when(rpc.call(eq("eth_call"), anyList())).thenReturn("0x" + "0".repeat(63) + "1",
                "0x" + "0".repeat(64));
        assertThatThrownBy(() -> service.verify(address)).isInstanceOf(ChainFailure.class);
    }

    @Test
    void malformedAddressIsRejectedWithoutRpcTraffic() {
        clearInvocations(rpc);
        assertThatThrownBy(() -> service.verify("0x1234")).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(rpc);
    }
}
