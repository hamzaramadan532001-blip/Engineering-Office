import { useMap } from "../../MapProvidor";
import Widgets from "./Widgets";
import Wrapper from "./Wraper";

export default function SubTools() {
  const { state } = useMap();
  switch (state.selectedTool) {
    case "widgets":
      return (
        <Wrapper>
          <Widgets />
        </Wrapper>
      );
    default:
      return null;
  }
}
