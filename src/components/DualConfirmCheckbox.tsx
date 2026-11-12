import React from "react";
import { Checkbox } from "./Checkbox";
import { PARTY_LABEL, type DualState, type Party } from "../lib/dualConfirm";

interface DualConfirmCheckboxProps {
  state: DualState;
  /** Which side the person looking at the screen is -- they can only tick their own box. */
  viewerParty: Party;
  onToggle: (party: Party, checked: boolean) => void;
  className?: string;
}

export const DualConfirmCheckbox: React.FC<DualConfirmCheckboxProps> = ({ state, viewerParty, onToggle, className = "" }) => (
  <div className={`inline-flex items-center gap-3 ${className}`}>
    {(["admin", "superadmin"] as Party[]).map((party) => {
      const mine = party === viewerParty;
      return (
        <label
          key={party}
          title={mine ? undefined : `Only the ${PARTY_LABEL[party]} can tick this`}
          className={`flex items-center gap-1 text-xs ${mine ? "text-foreground" : "text-muted-foreground"}`}
        >
          <Checkbox
            checked={state[party]}
            disabled={!mine}
            onChange={() => onToggle(party, !state[party])}
            className={mine ? "" : "cursor-not-allowed opacity-60"}
          />
          {PARTY_LABEL[party]}
        </label>
      );
    })}
  </div>
);
