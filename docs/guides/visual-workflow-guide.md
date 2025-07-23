# Visual Workflow Guide

This guide provides a visual walkthrough of the Knowledge Pipeline v4.0 workflow, from PDF ingestion to enriched content in Notion.

## Pipeline Overview Diagram

```mermaid
graph LR
    subgraph "Input Sources"
        A1[📁 Google Drive PDFs]
        A2[💾 Local Downloads]
    end
    
    subgraph "Ingestion"
        B[🔄 PDF Scanner]
        C[#️⃣ Hash Check]
        D[📥 Download & Extract]
    end
    
    subgraph "AI Processing"
        E[🏷️ Classification]
        F[🎯 Prompt Selection]
        G[🤖 AI Analysis]
        H[💯 Quality Scoring]
    end
    
    subgraph "Storage"
        I[📝 Notion Page]
        J[✨ Attribution]
        K[📊 Rich Formatting]
    end
    
    A1 --> B
    A2 --> B
    B --> C
    C -->|New| D
    C -->|Duplicate| X[❌ Skip]
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    I --> J
    J --> K
    
    style F fill:#f9f,stroke:#333,stroke-width:4px
    style G fill:#bbf,stroke:#333,stroke-width:4px
    style J fill:#bfb,stroke:#333,stroke-width:4px
```

## Step-by-Step Process

### Step 1: Content Discovery

```mermaid
flowchart TD
    A[Pipeline Starts] --> B{Local PDFs?}
    B -->|Yes| C[Scan Downloads Folder]
    B -->|No| D[Skip to Drive]
    C --> E[Upload to Drive]
    E --> D[Scan Google Drive]
    D --> F[List All PDFs]
    F --> G[Check Each PDF]
    
    style C fill:#ffd,stroke:#333,stroke-width:2px
    style E fill:#dfd,stroke:#333,stroke-width:2px
```

**What happens:**
- Checks your Downloads folder for new PDFs (optional)
- Uploads local PDFs to Google Drive
- Scans configured Drive folders
- Lists all PDF documents

### Step 2: Deduplication Check

```mermaid
flowchart LR
    A[PDF File] --> B[Generate SHA-256 Hash]
    B --> C{Hash Exists?}
    C -->|Yes| D[Skip File]
    C -->|No| E[Process File]
    E --> F[Create Notion Entry]
    F --> G[Status: Inbox]
    
    style C fill:#ffd,stroke:#333,stroke-width:2px
    style F fill:#dfd,stroke:#333,stroke-width:2px
```

**What happens:**
- Calculates unique hash for each PDF
- Checks if content already exists
- Prevents duplicate processing
- Creates new entry with Status="Inbox"

### Step 3: AI Enrichment Process

```mermaid
flowchart TD
    subgraph "Content Analysis"
        A[📄 PDF Text] --> B[Content Classifier]
        B --> C{Content Type?}
        C -->|Research| D1[Research Prompts]
        C -->|Market News| D2[Market Prompts]
        C -->|Technical| D3[Technical Prompts]
        C -->|Other| D4[Default Prompts]
    end
    
    subgraph "Prompt Selection"
        D1 --> E{Check Sources}
        D2 --> E
        D3 --> E
        D4 --> E
        E -->|1st| F[📊 Notion Database]
        E -->|2nd| G[📁 YAML Config]
        F --> H[Selected Prompt]
        G --> H
    end
    
    subgraph "AI Processing"
        H --> I[🤖 GPT-4 Analysis]
        I --> J[Summary]
        I --> K[Insights]
        I --> L[Tags]
        I --> M[Quality Score]
    end
    
    style B fill:#ffd,stroke:#333,stroke-width:2px
    style F fill:#f9f,stroke:#333,stroke-width:4px
    style I fill:#bbf,stroke:#333,stroke-width:4px
```

### Step 4: Quality Scoring

```mermaid
flowchart LR
    subgraph "Quality Components"
        A[📊 Relevance<br/>40 points] 
        B[📈 Completeness<br/>30 points]
        C[🎯 Actionability<br/>30 points]
    end
    
    subgraph "Scoring"
        A --> D[Calculate Total]
        B --> D
        C --> D
        D --> E{Score Range?}
        E -->|90-100| F[⭐ Exceptional]
        E -->|70-89| G[✅ High Quality]
        E -->|50-69| H[⚡ Good]
        E -->|0-49| I[⚠️ Low Quality]
    end
    
    style D fill:#ffd,stroke:#333,stroke-width:2px
```

### Step 5: Notion Storage

```mermaid
flowchart TD
    subgraph "Page Structure"
        A[📄 Page Created] --> B[Header Section]
        B --> C[Metadata Block]
        C --> D[Summary Section]
        D --> E[Insights Section]
        E --> F[Tags Section]
        F --> G[Attribution Block]
        G --> H[Original Content]
    end
    
    subgraph "Final Steps"
        H --> I[Update Status]
        I --> J[Status: Enriched ✅]
        J --> K[Ready for Use]
    end
    
    style G fill:#bfb,stroke:#333,stroke-width:2px
    style J fill:#dfd,stroke:#333,stroke-width:2px
```

## Visual Examples

### Before: Raw PDF in Drive
```
📁 Google Drive
  └── 📄 research-paper-2024.pdf (2.3 MB)
      └── Status: Unprocessed
      └── Content: Raw PDF binary
```

### After: Enriched Notion Page
```
📑 Notion Database
  └── 📄 "Advanced RAG Techniques 2024"
      ├── Status: Enriched ✅
      ├── Quality Score: 92/100 ⭐
      ├── 🎯 Executive Summary (300 words)
      ├── 💡 Key Insights (5 actionable items)
      ├── 🏷️ Tags: rag, retrieval, llm-systems
      ├── ✨ Attribution: summarizer/research v2.1
      └── 📎 Original PDF Text (preserved)
```

## Processing Timeline

```mermaid
gantt
    title Pipeline Processing Timeline
    dateFormat mm:ss
    section Discovery
    Scan Drive     :01:00, 10s
    Check Hashes   :10s
    section Download
    Download PDFs  :20s
    Extract Text   :10s
    section AI Analysis
    Classification :5s
    Summarization  :15s
    Insights       :10s
    Tagging        :5s
    section Storage
    Create Page    :5s
    Format Content :5s
    Update Status  :2s
```

**Typical Processing Time**: 
- Per document: 60-90 seconds
- Batch of 10: 8-10 minutes
- Mostly AI processing time

## Status Flow Diagram

```mermaid
stateDiagram-v2
    [*] --> NotInDatabase: New PDF Found
    NotInDatabase --> Inbox: Create Entry
    Inbox --> Processing: AI Enrichment
    Processing --> Enriched: Success ✅
    Processing --> Failed: Error ❌
    Failed --> Inbox: Retry
    Enriched --> Archived: Optional
    Archived --> [*]
    
    note right of Processing
        Multiple AI calls:
        - Classification
        - Summarization
        - Insights
        - Tagging
        - Quality
    end note
```

## Key Visual Indicators

### In Notion Database

| Indicator | Meaning |
|-----------|---------|
| 📥 | Status: Inbox (awaiting processing) |
| ✅ | Status: Enriched (ready to read) |
| ❌ | Status: Failed (check logs) |
| ⭐ | Quality: Exceptional (90-100) |
| ✅ | Quality: High (70-89) |
| ⚡ | Quality: Good (50-69) |
| ⚠️ | Quality: Low (0-49) |

### In Page Content

| Section | Icon | Purpose |
|---------|------|---------|
| Summary | 🎯 | Quick overview |
| Insights | 💡 | Actionable findings |
| Tags | 🏷️ | Categorization |
| Attribution | ✨ | Prompt transparency |
| Original | 📎 | Source preservation |

## Tips for Visual Navigation

1. **Dashboard View**: Create a Notion gallery view with cover images showing quality scores
2. **Color Coding**: Use Notion's background colors based on Content-Type
3. **Quick Filters**: Set up views for "High Quality Only" or "Recent Enrichments"
4. **Visual Search**: Use emojis in search to find specific section types

---

This visual guide helps you understand exactly how your PDFs transform into actionable intelligence in your Notion knowledge base.