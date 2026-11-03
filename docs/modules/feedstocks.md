# Feedstocks Module

The **Feedstocks Module** provides predefined categories of organic waste materials used to initiate composting batches.

---

## 📍 Endpoints Overview

| Method | Endpoint | Protected | Description |
| :--- | :--- | :---: | :--- |
| **`GET`** | `/feedstocks` | 🌐 Public | Lists all active feedstock classifications. |

---

## 🔍 Detailed Endpoints

### 1. `GET /feedstocks`
Returns all active feedstocks sorted for display during batch setup.

* **Authorization:** Public (`@Public()`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "cm1feed01",
        "name": "Food Scraps",
        "category": "Green (Nitrogen-Rich)",
        "description": "Vegetable peelings, fruit rinds, leftover food",
        "status": "active"
      },
      {
        "id": "cm1feed02",
        "name": "Dry Leaves",
        "category": "Brown (Carbon-Rich)",
        "description": "Fallen leaves, dried plant material",
        "status": "active"
      }
    ],
    "timestamp": "2026-11-03T01:20:00.000Z"
  }
  ```

---

## 🔗 Batch Integration

When operators log composting batches via mobile clients:
1. `Feedstock` items are chosen and assigned individual weights (`BatchFeedstock`).
2. The initial biomass total is computed as the sum of all component feedstock weights.
3. Final compost yield is tracked separately in `CompostOutput`.

