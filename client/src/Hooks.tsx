import { FluentIcon, CircleFilled } from "@fluentui/react-icons";

interface Props {
  DefaultIcon: FluentIcon;
  HoverIcon: FluentIcon;
  classes: string;
  onClick: ((event: React.MouseEvent) => void) | undefined;
  floating?: true;
}

export const HoverableIcon = ({
  DefaultIcon,
  HoverIcon,
  classes,
  onClick,
  floating,
}: Props) => (
  <div
    className={`icon-container hoverable ${classes}`}
    onClick={onClick}
  >
    {floating && <CircleFilled className="icon floating background" />}
    <DefaultIcon className={`icon default ${floating ? "floating" : ""}`} />
    <HoverIcon className={`icon hover ${floating ? "floating" : ""}`} />
  </div>
);
