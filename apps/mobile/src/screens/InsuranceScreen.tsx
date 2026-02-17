import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { StaticInfoScreen } from "../components/StaticInfoScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Insurance">;

export function InsuranceScreen({ navigation }: Props) {
  return (
    <StaticInfoScreen
      title="Insurance"
      description="Learn how we protect renters and owners with flexible coverage options."
      ctaLabel="Upload documents"
      onPressCta={() => navigation.navigate("InsuranceUpload")}
    />
  );
}
