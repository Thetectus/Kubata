/**
 * Ecrã de arranque, curto (~4.5s), com a marca Kubata/TheTectus e um
 * pequeno "cubo" 3D em CSS puro — não usa three.js aqui de propósito,
 * para não pesar no primeiro carregamento (isso fica só na
 * pré-visualização 3D, carregada por pedido).
 */
export function LoadingScreen({ fadingOut }: { fadingOut: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        background: "linear-gradient(160deg, #1c130c 0%, #2b1c10 100%)",
        color: "#f5ead9",
        fontFamily: "sans-serif",
        opacity: fadingOut ? 0 : 1,
        transition: "opacity 0.5s ease",
        pointerEvents: fadingOut ? "none" : "auto",
      }}
    >
      <div style={{ perspective: 500 }}>
        <div
          style={{
            width: 90,
            height: 90,
            position: "relative",
            transformStyle: "preserve-3d",
            animation: "kubata-cube-spin 3.2s linear infinite",
          }}
        >
          <CubeFace transform="rotateY(0deg) translateZ(45px)" color="#c96f3c" />
          <CubeFace transform="rotateY(90deg) translateZ(45px)" color="#b7845a" />
          <CubeFace transform="rotateY(180deg) translateZ(45px)" color="#a5633a" />
          <CubeFace transform="rotateY(-90deg) translateZ(45px)" color="#b7845a" />
          <CubeFace transform="rotateX(90deg) translateZ(45px)" color="#e0a35f" />
          <CubeFace transform="rotateX(-90deg) translateZ(45px)" color="#7c4a1e" />
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1 }}>Kubata</div>
        <div style={{ fontSize: 14, color: "#c9b8a4", marginTop: 4 }}>um software da TheTectus</div>
      </div>

      <style>{`
        @keyframes kubata-cube-spin {
          from { transform: rotateX(-22deg) rotateY(0deg); }
          to { transform: rotateX(-22deg) rotateY(360deg); }
        }
      `}</style>
    </div>
  );
}

function CubeFace({ transform, color }: { transform: string; color: string }) {
  return (
    <div
      style={{
        position: "absolute",
        width: 90,
        height: 90,
        background: color,
        border: "1px solid rgba(0,0,0,0.25)",
        transform,
      }}
    />
  );
}
