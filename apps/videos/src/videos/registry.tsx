import type { ComponentProps, ComponentType } from "react";
import { Composition } from "remotion";

interface VideoMeta {
  durationInFrames: number;
  fps: number;
  height: number;
  width: number;
}

interface VideoModule {
  default: ComponentType;
  defaultProps?: Record<string, unknown>;
  meta: VideoMeta;
  schema?: ComponentProps<typeof Composition>["schema"];
}

interface WebpackContext {
  keys: () => string[];
  (key: string): unknown;
}

const VIDEOS = (
  require as unknown as {
    context: (
      directory: string,
      deep?: boolean,
      filter?: RegExp
    ) => WebpackContext;
  }
).context(".", true, /^\.\/[^/]+\/index\.tsx$/);

const ID = /^\.\/([^/]+)\/index\.tsx$/;

export function Videos() {
  return (
    <>
      {VIDEOS.keys().map((key) => {
        const id = ID.exec(key)?.[1];
        if (id === undefined) {
          return null;
        }

        const video = VIDEOS(key) as VideoModule;

        return (
          <Composition
            component={video.default}
            defaultProps={video.defaultProps}
            durationInFrames={video.meta.durationInFrames}
            fps={video.meta.fps}
            height={video.meta.height}
            id={id}
            key={id}
            schema={video.schema}
            width={video.meta.width}
          />
        );
      })}
    </>
  );
}

export function withVideos(Root: ComponentType) {
  return function Registered() {
    return (
      <>
        <Root />
        <Videos />
      </>
    );
  };
}
