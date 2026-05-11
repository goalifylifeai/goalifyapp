# Play Console — Data Safety & Content Rating

## Content Rating Questionnaire (IARC)

Answer these exactly when Google's questionnaire asks:

| Question | Answer |
|---|---|
| App category | **Productivity** |
| Does the app contain or link to violent content? | No |
| Does the app contain sexual content or nudity? | No |
| Does the app contain profanity or crude humour? | No |
| Does the app reference illegal drugs, alcohol, or tobacco? | No |
| Does the app depict gambling or simulate gambling? | No |
| Does the app contain horror or fear-inducing content? | No |
| Does the app allow users to share content publicly with others? | No (all content is private per-user) |
| Does the app share real-time location? | No |
| Does the app allow users to interact with each other? | No |
| Does the app display user-generated content (UGC) from other users? | No |
| Does the app contain news or political content? | No |

**Expected rating: Everyone (3+)** — No content restrictions apply.

---

## Data Safety Section

Fill in the Google Play Console "Data Safety" form as follows.

### Does your app collect or share any of the required user data types?
**Yes**

---

### Data Types Collected

#### Personal info
| Data type | Collected? | Shared? | Optional? | Purposes |
|---|---|---|---|---|
| Name | Yes | No | No | App functionality |
| Email address | Yes | No | No | Account management, App functionality |
| User IDs | Yes | No | No | Account management |
| Pronouns | Yes | No | Yes (user can skip) | App functionality (personalisation) |

#### App activity
| Data type | Collected? | Shared? | Optional? | Purposes |
|---|---|---|---|---|
| App interactions | Yes | No | No | App functionality, Analytics |
| In-app search history | No | — | — | — |
| Installed apps | No | — | — | — |
| Other user-generated content (goals, habits, journal, coach messages) | Yes | No | No | App functionality |

#### App info and performance
| Data type | Collected? | Shared? | Optional? | Purposes |
|---|---|---|---|---|
| Crash logs | Yes | No | No | Analytics (bug fixing) |
| Diagnostics | Yes | No | No | Analytics (bug fixing) |

#### Device or other IDs
| Data type | Collected? | Shared? | Optional? | Purposes |
|---|---|---|---|---|
| Device or other IDs | No | — | — | — |

---

### Security Practices

| Question | Answer |
|---|---|
| Is data encrypted in transit? | **Yes** — all data is sent over HTTPS/TLS |
| Is data encrypted at rest? | **Yes** — Supabase encrypts data at rest |
| Do you follow the Families Policy? | No (app is not directed at children) |
| Does the app provide a way for users to request data deletion? | **Yes** — users can email privacy@goalify.life |

---

### Data not collected
- Location
- Financial info
- Health and fitness data (no HealthKit or Fitness API)
- Contacts
- Calendar data is **written only** (we write habit events; we never read existing events)
- Web browsing history
- Photos / videos / audio files
- Device or other IDs used for tracking

---

## Notes for the Calendar Permission Declaration

When Play Console asks about the `READ_CALENDAR` / `WRITE_CALENDAR` permissions:

- **WRITE_CALENDAR** is used to create recurring habit reminder events at the user's explicit request.
- **READ_CALENDAR** is declared in the manifest but the app only uses `WRITE_CALENDAR` in practice.
  Consider removing `READ_CALENDAR` from `app.config.js` if it is not actively used — this simplifies the declaration.

Permission usage statement to enter in Play Console:
> "Goalify uses calendar write access to create recurring reminder events for habits the user has chosen to sync. The app does not read, modify, or delete any existing calendar events."
