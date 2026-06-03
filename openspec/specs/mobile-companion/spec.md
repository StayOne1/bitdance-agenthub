# Mobile Companion

## Purpose

Defines the planned Capacitor companion app and remote approval surface. Detailed planning lives in `specs/14-mobile-remote.md`.

## Requirements

### Requirement: Mobile companion SHALL connect to a trusted local host

The mobile app MUST connect to a desktop AgentHub host over trusted LAN or Tailscale-style private networking.

#### Scenario: Mobile client pairs
- **WHEN** a user enters or scans a pairing token
- **THEN** the host authorizes the device session before exposing conversation data.

### Requirement: Mobile APIs SHALL expose conversation snapshots

Remote mobile APIs MUST provide a compact snapshot of conversations, messages, pending questions, pending writes, and run state needed for monitoring.

#### Scenario: User opens mobile app
- **WHEN** the app requests the snapshot endpoint
- **THEN** it receives current conversation state without direct database access.

### Requirement: Mobile approvals SHALL map to server-side pending items

Mobile approval actions MUST call server APIs that resolve existing pending write or pending question records.

#### Scenario: User approves a pending write on mobile
- **WHEN** the mobile API receives approval
- **THEN** the desktop host applies the same ToolExecutor approval path as desktop UI.

### Requirement: Mobile feature SHALL remain optional

The desktop/web app MUST continue to function when no mobile companion is configured.

#### Scenario: No mobile token exists
- **WHEN** AgentHub starts
- **THEN** core chat, adapters, tools, and artifacts remain available.
