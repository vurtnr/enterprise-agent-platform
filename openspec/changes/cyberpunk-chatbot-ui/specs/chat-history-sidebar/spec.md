## ADDED Requirements

### Requirement: Sidebar provides new chat entry
The client SHALL provide a left sidebar with a clear "New Chat" control.

#### Scenario: User starts a new chat
- **WHEN** a user clicks the "New Chat" button
- **THEN** the active chat view resets to a new empty conversation

### Requirement: Sidebar lists chat history
The sidebar SHALL display a list of recent chat sessions for navigation.

#### Scenario: User sees existing chat threads
- **WHEN** the user opens the chat page
- **THEN** the sidebar shows a scrollable list of past conversations

### Requirement: Selecting history switches active chat
Selecting a history item SHALL load that conversation into the main chat panel.

#### Scenario: User opens a previous conversation
- **WHEN** a user clicks a history item
- **THEN** the chat area renders that conversation as the active thread
