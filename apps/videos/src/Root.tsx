import { Composition, Folder } from "remotion";
import { ForeningVideo } from "./compositions/ForeningVideo";
import { SaljareVideo } from "./compositions/SaljareVideo";
import { CompanyVideo } from "./compositions/CompanyVideo";
import { VIDEO } from "./components/BrandColors";

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Roots-Explainers">
      <Composition
        id="ForeningVideo"
        component={ForeningVideo}
        durationInFrames={555}
        fps={VIDEO.FPS}
        width={VIDEO.WIDTH}
        height={VIDEO.HEIGHT}
      />
      <Composition
        id="SaljareVideo"
        component={SaljareVideo}
        durationInFrames={555}
        fps={VIDEO.FPS}
        width={VIDEO.WIDTH}
        height={VIDEO.HEIGHT}
      />
      <Composition
        id="CompanyVideo"
        component={CompanyVideo}
        durationInFrames={750}
        fps={VIDEO.FPS}
        width={VIDEO.WIDTH}
        height={VIDEO.HEIGHT}
      />
    </Folder>
  );
};
