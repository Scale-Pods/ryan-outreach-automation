# 🌟 Naples Homes - Outreach Automation Platform
> **First Look & System Version Overview**  
> *Powered by ScalePods*

Welcome to the **Naples Homes Outreach Automation Platform**. This platform is a central hub designed to capture leads, run marketing campaigns, automate omnichannel follow-ups (Email, WhatsApp, and Voice calls), and monitor integration balances in real-time. 

This document provides a complete guide to the platform's frontend layout, core modules, lead journey workflows, and integrated monitoring tools.

---

## 🗺️ Platform Architecture & Navigation

The platform features a sleek, glassmorphic sidebar layout that allows you to seamlessly switch between **Master Overview** and channel-specific dashboards:

```
[Master Dashboard] ─── High-Level KPIs & Cross-Channel Acquisition Trend
       ├── [Email Marketing] ── Campaign Deliverability & Inbox Health (Loop-based stats)
       ├── [WhatsApp CRM] ──── Broadcaster, Leads Tracking & Live Dialogue Chat
       ├── [Voice Agent] ───── AI Call Logs, Detailed Cost Breakdown & Setup Prompts
       └── [Credentials] ───── Wallet Monitors (Vapi / Twilio) & API Configs
```

---

## 📊 1. Master Dashboard Overview

The **Master Overview** serves as your control room. It consolidates data from all channels within your custom-selected date ranges.

### Key Metrics Tracked
*   **Total Leads:** Cumulative leads synced to the platform, complete with real-time acquisition timelines.
*   **Total Emails Sent:** Live volume tracking of all campaign distributions.
*   **Total WhatsApp Reachouts:** The number of unique prospective clients contacted via WhatsApp.
*   **Total Voice Calls:** Total count of outbound and inbound AI telephone calls.
*   **Total Replies:** A dynamic calculation representing the engagement rate (`Total Replies` / `WhatsApp Reachouts`), with quick-expand capabilities to show exactly who replied.

### Interactive Analytics
*   **Lead Acquisition Trend (Area Chart):** Visually monitors your daily lead ingestion rates to track peak growth periods.
*   **Response Performance (Donut Chart):** Shows the distribution of outreach effort across Email, WhatsApp, and Voice.
*   **Live Wallet Status Indicators:** Displayed in the header:
    *   **Vapi Credit Consumption:** Reflects the total cost consumed by the AI voice engine.
    *   **Twilio Account Balance:** Displays the remaining funds on your carrier account.

---

## 👥 2. Leads & Journey Tracking

The **Leads Manager** (`/dashboard/leads`) provides a unified list of all prospects, their active loop stages, reply statuses, and progress tracking.

### 🇺🇸 vs. 🌐 Automated Outreach Flows
The system automatically detects whether a lead is **USA-based** (using phone number pattern matching) or **Global** and maps them to their respective campaign flow:

| Day of Outreach | 🇺🇸 USA Lead Journey Flow | 🌐 Global Lead Journey Flow |
| :--- | :--- | :--- |
| **Day 0** | WhatsApp Message 1 + Email 1 (Dual Channel) | WhatsApp Message 1 |
| **Day 2** | WhatsApp Message 2 | WhatsApp Message 2 |
| **Day 3** | AI Voice Call 1 | AI Voice Call 1 |
| **Day 4** | AI Voice Call 2 | AI Voice Call 2 |
| **Day 5** | Email 2 | WhatsApp Message 3 |
| **Day 7** | Email 3 | WhatsApp Message 4 |

### Visual Lead Journeys
*   **Progress Indicators:** Shows a progress percentage bar (e.g., `Stage 2 of 6 - 33% Complete`) for each lead.
*   **Journey Popups:** Clicking a lead's progress bar opens an interactive circular chart highlighting which milestones (Day 0 through Day 7) have been achieved.
*   **Template Library Tab:** A shared library allowing you to inspect active **Email Templates** and **WhatsApp Templates** divided by categories (e.g., Intro, Nurturing).

---

## ✉️ 3. Email Marketing Center

The **Email Dashboard** (`/dashboard/email`) tracks campaigns and verifies inbox health to ensure high deliverability rates.

### Campaign Loop Management
The platform divides email sequences into three distinct loops:
1.  **Intro Loop:** Sequences 1 through 3.
2.  **Follow Up Loop:** Sequences 1 through 3.
3.  **Nurture Loop:** repeats systematically, running sequences 1 through 9.

### Sub-Modules
*   **Analytics:** Displays delivery, open, and response statistics.
*   **Sent Logs:** Records details of every outgoing email transmission.
*   **Received Logs:** Lists direct replies from prospects for fast follow-ups.
*   **Bounces Tracker:** Monitors delivery failures to keep your email list clean and avoid spam filters.
*   **Unsubscribed:** Logs clients who opt out to maintain strict compliance.

---

## 💬 4. WhatsApp CRM

The **WhatsApp CRM** (`/dashboard/whatsapp`) tracks campaign outreach and provides tools for live conversation management.

### Key Features
*   **Conversion Funnel (Donut Chart):** Compares unique messages sent, total messages sent, and replies received.
*   **Activity Trends (Line Chart):** Maps daily outreach vs. replies side-by-side to highlight response spikes.
*   **Interactive Two-way Chat Screen:** Accessing `/dashboard/whatsapp/chat` loads a dual-pane messaging layout:
    *   **Left Pane:** Searchable lists of customers sorted by outreach state.
    *   **Right Pane:** A clean chat dialogue window displaying the complete history of messages exchanged, with real-time status tracking (Sent/Received/Read).

---

## 🎙️ 5. AI Voice Agent Hub

The **Voice Agent Hub** (`/dashboard/voice`) enables you to manage human-like AI assistants that handle calls.

### Sub-Modules
*   **Daily Call Volume & Hourly Call Distribution:** Monitors call frequency, identifying peak calling hours.
*   **Call Logs (`/dashboard/voice/logs`):** Displays call history including:
    *   **Caller Detail:** Name, Phone Number, Inbound vs. Outbound tag.
    *   **Lead Temperature:** Automatically rates leads as **HOT** 🔥, **WARM** ☀️, or **COLD** ❄️ based on call dialogue.
    *   **Detailed Call Transcript & Recording Player:** Open any log to read the conversation transcript or listen to the call audio.
    *   **Excel Export:** Allows downloading of complete log sheets including cost breakdowns.
*   **Cost Calculator (`/dashboard/voice/calculator`):** Select a date range and segment (e.g., *All Vapi Calls*, *Normal Calls*, or *Open House Events*) to calculate:
    *   Total Estimated Cost
    *   Vapi (AI/Agent Processing) portion
    *   Twilio (Telephony carrier) portion
    *   Average cost per call & total minutes.

---

## 🔑 6. Credentials & Integrations

The **Credentials page** (`/dashboard/credentials`) displays all backend links and wallet statuses:

*   **Email Integration:** Lists detected sender email addresses configured for outgoing campaigns.
*   **WhatsApp Business API:** Manages Meta WhatsApp API slots.
*   **Provisioned Phone Numbers:**
    *   🇬🇧 **Twilio UK Line:** `+1 (970) 236 7780` (Agent ID: `918c25eb-9882-452e-86df-b4851d464852`)
    *   🇺🇸 **Twilio US Line:** `+1 (239) 306 7557` (Agent ID: `b35e3032-7865-4913-ba22-a913b5d4117b`)
*   **Wallet Configurations:**
    *   **Vapi Wallet:** Displays Vapi agent credits consumed over the platform's lifetime.
    *   **Twilio Telephony Wallet:** Displays live available balance, pay-as-you-go recharges, and overall carrier spend to date.
