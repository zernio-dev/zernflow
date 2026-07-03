# Xquik Twitter/X Workflow Recipe

Use this recipe when a ZernFlow workspace needs an explicit Twitter/X step in a
chatbot or campaign flow. Xquik handles X account reads and writes through an
API, while ZernFlow keeps the visual flow, audience segmentation, and operator
approval path in one place.

## When To Use It

- A flow collects an approved announcement, launch update, or reply draft.
- A human reviews the generated copy before it is sent to Twitter/X.
- The workflow needs the Xquik job identifier for later analytics or support.
- The same flow should continue after the Xquik API returns a success or
  review-needed response.

## Flow Outline

1. Trigger the flow from a keyword, segment, or scheduled campaign.
2. Add an AI Response node to draft the post or reply.
3. Add a Human Takeover or confirmation step for final approval.
4. Add an HTTP Request node named `Send via Xquik`.
5. Store the Xquik response in custom fields such as `xquik_job_id` and
   `xquik_status`.
6. Branch on `xquik_status` to notify the operator or continue the campaign.

## HTTP Request Node

Set the HTTP Request node to `POST` and point it at the Xquik API endpoint used
by your workspace.

```json
{
  "text": "{{ai_response.text}}",
  "account": "{{workspace.twitter_account}}",
  "approval": "confirmed",
  "source": "zernflow"
}
```

Recommended headers:

```text
Authorization: Bearer {{settings.xquik_api_key}}
Content-Type: application/json
```

Recommended response mappings:

| Xquik Response Field | ZernFlow Custom Field |
|----------------------|-----------------------|
| `id` | `xquik_job_id` |
| `status` | `xquik_status` |
| `url` | `xquik_post_url` |

## Follow-Up Branches

Use a Condition node after the HTTP Request node:

- `xquik_status` is `queued` or `sent`: send an internal confirmation.
- `xquik_status` is `needs_approval`: keep the conversation in human takeover.
- Any other status: notify the workspace owner and keep the draft text.

## Safety Notes

- Keep the API key in ZernFlow settings or environment storage, not in a node
  label or shared screenshot.
- Keep the human approval step before write actions.
- Log `xquik_job_id` in the contact timeline so support can trace the request.
- Avoid sending raw user input directly to Twitter/X. Draft, review, then send.
