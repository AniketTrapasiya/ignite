For your **Indite AI Agent platform**, a **Master Skill Set** means the **core capabilities that any agent can use to perform automation tasks**.

Think of skills like **“tools for agents.”**
Each agent is created by combining multiple skills.

Example:

**Sales Agent**

Goal → Handle leads
Skills → Monitor leads + Send WhatsApp + Book meeting + Update CRM

Below is a **complete Master Skill Set structure** you can implement.

---

# 🧠 Indite Master Skill Set

## 1️⃣ Communication Skills

Agents communicate with users, customers, or teams.

Skills:

* Send Email
* Reply Email
* Send WhatsApp Message
* Send SMS
* Send Slack Message
* Send Discord Message
* Send Push Notification
* Send Webhook

Example use:

```
Send WhatsApp message to new lead
```

---

# 2️⃣ Lead & CRM Skills

Handle customer data and sales pipelines.

Skills:

* Create Lead
* Update Lead
* Assign Lead
* Add CRM Contact
* Update CRM Contact
* Add Lead Notes
* Change Lead Status

Example:

```
Create CRM contact after form submission
```

---

# 3️⃣ Monitoring / Trigger Skills

Agents watch systems and trigger actions.

Skills:

* Monitor Facebook Leads
* Monitor Website Forms
* Monitor Email Inbox
* Monitor Stripe Payments
* Monitor Shopify Orders
* Monitor Database Changes
* Monitor API Events

Example:

```
Monitor Facebook lead form
```

---

# 4️⃣ AI Intelligence Skills

Agents analyze data and make decisions.

Skills:

* Lead Qualification
* Sentiment Analysis
* Message Generation
* Email Drafting
* Content Summarization
* Auto Categorization
* Intent Detection

Example:

```
Analyze lead message and score quality
```

---

# 5️⃣ Scheduling Skills

Automate time-based actions.

Skills:

* Schedule Task
* Send Follow-up Message
* Schedule Meeting
* Set Reminder
* Delayed Workflow
* Calendar Booking

Example:

```
Send follow-up after 24 hours
```

---

# 6️⃣ Data Management Skills

Store and process data.

Skills:

* Save to Database
* Read Database
* Update Database
* Export CSV
* Save to Google Sheets
* Retrieve Records

Example:

```
Save lead to Google Sheets
```

---

# 7️⃣ Marketing Automation Skills

Used by marketing teams.

Skills:

* Send Campaign Email
* Send Broadcast Message
* Add to Email List
* Segment Customers
* Track Campaign Performance

Example:

```
Add lead to marketing campaign
```

---

# 8️⃣ Workflow Logic Skills

Decision-making capabilities.

Skills:

* If Condition
* Switch Condition
* Loop Records
* Delay
* Retry Step
* Error Handling

Example:

```
If lead score > 80 notify sales
```

---

# 9️⃣ Integration Skills

Agents connect to external platforms.

Skills:

* Facebook Leads
* WhatsApp API
* Gmail
* Google Sheets
* Slack
* Stripe
* Shopify
* HubSpot
* Webhooks

Example:

```
Send data to Slack channel
```

---

# 🔟 Observability Skills

Track automation performance.

Skills:

* Log Event
* Send Alert
* Track Metrics
* Error Reporting
* Agent Performance Analysis

Example:

```
Notify admin if automation fails
```

---

# 🧩 Example Agent Composition

### Sales Agent

Goal:

```
Handle Facebook leads automatically
```

Skills used:

```
Monitor Facebook Leads
Lead Qualification
Send WhatsApp Message
Schedule Meeting
Create CRM Contact
Log Activity
```

---

# 🧠 Recommended Skill Data Model (Prisma)

Example table:

```
AgentSkill
---------
id
agentId
skillType
config (JSON)
createdAt
```

Example config:

```
skillType: SEND_WHATSAPP
config:
{
  "template": "Hello {{name}}, thanks for contacting us!"
}
```

---

# ⚡ Skill Categories for UI

In your UI show skills like:

```
Communication
AI Intelligence
Monitoring
CRM
Scheduling
Data
Marketing
Integrations
Logic
```

This makes agent creation **very intuitive**.

---

# 🚀 Advanced Future Skills (Game-Changer)

Later you can add:

* **Autonomous Research Agent**
* **Competitor Monitoring**
* **Auto Proposal Generation**
* **Sales Negotiation AI**
* **Customer Support AI**

These turn your platform into **AI workforce**.

---

✅ If you want, I can also show you:

* **The complete Prisma schema for Indite**
* **How to build an AI agent execution engine**
* **A skills marketplace like GPT tools**
* **Architecture that scales to millions of workflows**

These are **the real secrets behind platforms like n8n and Zapier.**
