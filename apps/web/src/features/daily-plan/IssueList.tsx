export function IssueList({
  messages,
  className = 'issue-list',
}: {
  readonly messages: readonly string[];
  readonly className?: string;
}) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <ul className={className}>
      {messages.map((message, index) => (
        <li key={`${message}-${index}`}>{message}</li>
      ))}
    </ul>
  );
}
