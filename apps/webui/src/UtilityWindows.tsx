import { WindowRoot } from "../../browser/src/App";
import { closeUtilityWindow, useUtilityWindows } from "./utilityWindows";

export function UtilityWindows() {
  const open = useUtilityWindows();
  return (
    <>
      {open.map((id) => (
        <div key={id} className="astro-utility-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeUtilityWindow(id)}>
          <div className="astro-utility-window" onKeyDown={(e) => e.key === "Escape" && closeUtilityWindow(id)}>
            <WindowRoot windowId={id} />
          </div>
        </div>
      ))}
    </>
  );
}
