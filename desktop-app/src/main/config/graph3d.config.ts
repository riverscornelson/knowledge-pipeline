/**
 * 3D Graph Visualization Configuration
 * Centralized configuration for graph visualization, data transformation, and performance settings
 */

export interface Graph3DConfig {
  // Data transformation settings
  transformation: {
    maxNodes: number;
    maxEdges: number;
    minNodeStrength: number;
    maxDepth: number;
    clustering: {
      enabled: boolean;
      algorithm: 'semantic' | 'temporal' | 'hierarchical' | 'force-directed';
      minClusterSize: number;
      maxClusters: number;
    };
    similarity: {
      threshold: number;
      algorithm: 'cosine' | 'jaccard' | 'tfidf';
      weightFactors: {
        content: number;
        tags: number;
        temporal: number;
        structural: number;
      };
    };
  };

  // Visualization settings
  visualization: {
    scene: {
      backgroundColor: string;
      ambientLightIntensity: number;
      directionalLightIntensity: number;
      fogEnabled: boolean;
      fogColor: string;
      fogDensity: number;
    };
    nodes: {
      defaultSize: number;
      sizeRange: { min: number; max: number };
      colors: { [nodeType: string]: string };
      opacity: number;
      showLabels: boolean;
      labelDistance: number;
      hoverEffect: {
        enabled: boolean;
        scaleMultiplier: number;
        glowIntensity: number;
      };
      selection: {
        outlineColor: string;
        outlineWidth: number;
        highlightConnections: boolean;
      };
    };
    edges: {
      enabled: boolean;
      defaultWidth: number;
      widthRange: { min: number; max: number };
      colors: { [edgeType: string]: string };
      opacity: number;
      curved: boolean;
      animateFlow: boolean;
      showArrows: boolean;
    };
    layout: {
      algorithm: 'force-directed' | 'hierarchical' | 'circular' | 'tree' | 'grid';
      parameters: {
        forceDirected: {
          nodeRepulsion: number;
          linkDistance: number;
          linkStrength: number;
          gravity: number;
          damping: number;
          iterations: number;
        };
        hierarchical: {
          levelSeparation: number;
          nodeSpacing: number;
          treeSpacing: number;
          blockShifting: boolean;
          edgeMinimization: boolean;
        };
        circular: {
          radius: number;
          spacing: number;
          startAngle: number;
        };
      };
    };
  };

  // Performance settings
  performance: {
    rendering: {
      maxFPS: number;
      adaptiveQuality: boolean;
      levelOfDetail: {
        enabled: boolean;
        nearDistance: number;
        farDistance: number;
        simplificationLevels: number;
      };
      culling: {
        frustum: boolean;
        occlusion: boolean;
        distance: number;
      };
    };
    physics: {
      enabled: boolean;
      updateFrequency: number;
      maxIterationsPerFrame: number;
      adaptiveTimeStep: boolean;
      stabilizationIterations: number;
    };
    memory: {
      maxCacheSize: number;
      cacheExpirationTime: number;
      garbageCollectionInterval: number;
      texturePoolSize: number;
    };
  };

  // Interaction settings
  interaction: {
    camera: {
      controls: 'orbit' | 'fly' | 'first-person';
      autoRotate: boolean;
      autoRotateSpeed: number;
      zoomSpeed: number;
      panSpeed: number;
      enableDamping: boolean;
      dampingFactor: number;
      minDistance: number;
      maxDistance: number;
      minPolarAngle: number;
      maxPolarAngle: number;
    };
    selection: {
      multiSelect: boolean;
      selectOnHover: boolean;
      hoverDelay: number;
      doubleClickAction: 'zoom' | 'expand' | 'details';
    };
    navigation: {
      minimap: {
        enabled: boolean;
        size: { width: number; height: number };
        position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
        opacity: number;
      };
      breadcrumbs: boolean;
      search: {
        enabled: boolean;
        fuzzySearch: boolean;
        highlightResults: boolean;
        maxResults: number;
      };
    };
  };

  // Data update settings
  updates: {
    realTime: {
      enabled: boolean;
      updateInterval: number;
      batchSize: number;
      throttleDelay: number;
    };
    animation: {
      nodeTransitions: boolean;
      edgeTransitions: boolean;
      layoutTransitions: boolean;
      transitionDuration: number;
      easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce';
    };
    incremental: {
      enabled: boolean;
      maxIncrementalUpdates: number;
      fallbackToFullRebuild: boolean;
    };
  };

  // Export settings
  export: {
    formats: string[];
    defaultFormat: string;
    imageExport: {
      resolution: { width: number; height: number };
      quality: number;
      transparentBackground: boolean;
    };
    videoExport: {
      fps: number;
      duration: number;
      format: 'mp4' | 'webm' | 'gif';
      quality: number;
    };
  };
}

/**
 * Default configuration
 */
export const defaultGraph3DConfig: Graph3DConfig = {
  transformation: {
    maxNodes: 1000,
    maxEdges: 2000,
    minNodeStrength: 0.1,
    maxDepth: 3,
    clustering: {
      enabled: true,
      algorithm: 'semantic',
      minClusterSize: 3,
      maxClusters: 10
    },
    similarity: {
      threshold: 0.3,
      algorithm: 'cosine',
      weightFactors: {
        content: 0.4,
        tags: 0.3,
        temporal: 0.2,
        structural: 0.1
      }
    }
  },

  visualization: {
    scene: {
      backgroundColor: '#000011',
      ambientLightIntensity: 0.4,
      directionalLightIntensity: 0.8,
      fogEnabled: true,
      fogColor: '#000011',
      fogDensity: 0.001
    },
    nodes: {
      defaultSize: 5,
      sizeRange: { min: 2, max: 15 },
      colors: {
        document: '#4A90E2',
        insight: '#F5A623',
        tag: '#7ED321',
        person: '#D0021B',
        concept: '#9013FE',
        source: '#50E3C2',
        default: '#999999'
      },
      opacity: 0.8,
      showLabels: true,
      labelDistance: 20,
      hoverEffect: {
        enabled: true,
        scaleMultiplier: 1.3,
        glowIntensity: 0.5
      },
      selection: {
        outlineColor: '#ffffff',
        outlineWidth: 2,
        highlightConnections: true
      }
    },
    edges: {
      enabled: true,
      defaultWidth: 1,
      widthRange: { min: 0.5, max: 4 },
      colors: {
        reference: '#666666',
        similarity: '#888888',
        derivation: '#aa6666',
        tag: '#66aa66',
        mention: '#6666aa',
        'parent-child': '#aa66aa',
        default: '#666666'
      },
      opacity: 0.6,
      curved: false,
      animateFlow: false,
      showArrows: true
    },
    layout: {
      algorithm: 'force-directed',
      parameters: {
        forceDirected: {
          nodeRepulsion: 1000,
          linkDistance: 100,
          linkStrength: 0.1,
          gravity: 0.02,
          damping: 0.95,
          iterations: 100
        },
        hierarchical: {
          levelSeparation: 200,
          nodeSpacing: 150,
          treeSpacing: 200,
          blockShifting: true,
          edgeMinimization: true
        },
        circular: {
          radius: 300,
          spacing: 50,
          startAngle: 0
        }
      }
    }
  },

  performance: {
    rendering: {
      maxFPS: 60,
      adaptiveQuality: true,
      levelOfDetail: {
        enabled: true,
        nearDistance: 100,
        farDistance: 1000,
        simplificationLevels: 3
      },
      culling: {
        frustum: true,
        occlusion: false,
        distance: 2000
      }
    },
    physics: {
      enabled: true,
      updateFrequency: 60,
      maxIterationsPerFrame: 10,
      adaptiveTimeStep: true,
      stabilizationIterations: 50
    },
    memory: {
      maxCacheSize: 100, // MB
      cacheExpirationTime: 300000, // 5 minutes
      garbageCollectionInterval: 60000, // 1 minute
      texturePoolSize: 50
    }
  },

  interaction: {
    camera: {
      controls: 'orbit',
      autoRotate: false,
      autoRotateSpeed: 0.5,
      zoomSpeed: 1.0,
      panSpeed: 1.0,
      enableDamping: true,
      dampingFactor: 0.1,
      minDistance: 50,
      maxDistance: 5000,
      minPolarAngle: 0,
      maxPolarAngle: Math.PI
    },
    selection: {
      multiSelect: true,
      selectOnHover: false,
      hoverDelay: 500,
      doubleClickAction: 'details'
    },
    navigation: {
      minimap: {
        enabled: true,
        size: { width: 200, height: 150 },
        position: 'bottom-right',
        opacity: 0.7
      },
      breadcrumbs: true,
      search: {
        enabled: true,
        fuzzySearch: true,
        highlightResults: true,
        maxResults: 50
      }
    }
  },

  updates: {
    realTime: {
      enabled: true,
      updateInterval: 30000, // 30 seconds
      batchSize: 50,
      throttleDelay: 1000
    },
    animation: {
      nodeTransitions: true,
      edgeTransitions: true,
      layoutTransitions: true,
      transitionDuration: 1000,
      easing: 'ease-in-out'
    },
    incremental: {
      enabled: true,
      maxIncrementalUpdates: 100,
      fallbackToFullRebuild: true
    }
  },

  export: {
    formats: ['json', 'csv', 'graphml', 'png', 'svg'],
    defaultFormat: 'json',
    imageExport: {
      resolution: { width: 1920, height: 1080 },
      quality: 0.9,
      transparentBackground: false
    },
    videoExport: {
      fps: 30,
      duration: 10,
      format: 'mp4',
      quality: 0.8
    }
  }
};

/**
 * Configuration for different performance profiles
 */
export const performanceProfiles = {
  'high-performance': {
    ...defaultGraph3DConfig,
    transformation: {
      ...defaultGraph3DConfig.transformation,
      maxNodes: 2000,
      maxEdges: 5000
    },
    performance: {
      ...defaultGraph3DConfig.performance,
      rendering: {
        ...defaultGraph3DConfig.performance.rendering,
        maxFPS: 120,
        adaptiveQuality: false
      }
    }
  },

  'balanced': defaultGraph3DConfig,

  'low-performance': {
    ...defaultGraph3DConfig,
    transformation: {
      ...defaultGraph3DConfig.transformation,
      maxNodes: 500,
      maxEdges: 1000
    },
    performance: {
      ...defaultGraph3DConfig.performance,
      rendering: {
        ...defaultGraph3DConfig.performance.rendering,
        maxFPS: 30,
        adaptiveQuality: true,
        levelOfDetail: {
          ...defaultGraph3DConfig.performance.rendering.levelOfDetail,
          enabled: true,
          nearDistance: 50,
          farDistance: 500
        }
      },
      physics: {
        ...defaultGraph3DConfig.performance.physics,
        updateFrequency: 30,
        maxIterationsPerFrame: 5
      }
    },
    visualization: {
      ...defaultGraph3DConfig.visualization,
      edges: {
        ...defaultGraph3DConfig.visualization.edges,
        animateFlow: false
      }
    }
  }
};

/**
 * Theme configurations
 */
export const themes = {
  dark: {
    scene: {
      backgroundColor: '#000011',
      fogColor: '#000011'
    },
    nodes: {
      colors: {
        document: '#4A90E2',
        insight: '#F5A623',
        tag: '#7ED321',
        person: '#D0021B',
        concept: '#9013FE',
        source: '#50E3C2',
        default: '#999999'
      }
    }
  },

  light: {
    scene: {
      backgroundColor: '#f5f5f5',
      fogColor: '#f5f5f5'
    },
    nodes: {
      colors: {
        document: '#1976d2',
        insight: '#ed6c02',
        tag: '#2e7d32',
        person: '#d32f2f',
        concept: '#7b1fa2',
        source: '#0288d1',
        default: '#666666'
      }
    }
  },

  cyberpunk: {
    scene: {
      backgroundColor: '#0d001a',
      fogColor: '#0d001a'
    },
    nodes: {
      colors: {
        document: '#00ffff',
        insight: '#ff0080',
        tag: '#00ff00',
        person: '#ff4000',
        concept: '#8000ff',
        source: '#ffff00',
        default: '#808080'
      }
    }
  }
};

/**
 * Utility functions for configuration management
 */
export class Graph3DConfigManager {
  private config: Graph3DConfig;

  constructor(initialConfig: Graph3DConfig = defaultGraph3DConfig) {
    this.config = { ...initialConfig };
  }

  getConfig(): Graph3DConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<Graph3DConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  applyPerformanceProfile(profile: keyof typeof performanceProfiles): void {
    this.config = { ...performanceProfiles[profile] };
  }

  applyTheme(theme: keyof typeof themes): void {
    const themeConfig = themes[theme];
    this.config = this.mergeConfig(this.config, {
      visualization: {
        ...this.config.visualization,
        scene: {
          ...this.config.visualization.scene,
          ...themeConfig.scene
        },
        nodes: {
          ...this.config.visualization.nodes,
          ...themeConfig.nodes
        }
      }
    });
  }

  validateConfig(config: Partial<Graph3DConfig>): boolean {
    // Basic validation logic
    try {
      if (config.transformation?.maxNodes && config.transformation.maxNodes < 1) {
        return false;
      }
      if (config.performance?.rendering?.maxFPS && config.performance.rendering.maxFPS < 1) {
        return false;
      }
      // Add more validation rules as needed
      return true;
    } catch {
      return false;
    }
  }

  resetToDefaults(): void {
    this.config = { ...defaultGraph3DConfig };
  }

  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  importConfig(configString: string): boolean {
    try {
      const importedConfig = JSON.parse(configString);
      if (this.validateConfig(importedConfig)) {
        this.config = this.mergeConfig(defaultGraph3DConfig, importedConfig);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private mergeConfig(base: any, updates: any): any {
    const result = { ...base };
    
    for (const key in updates) {
      if (updates[key] !== null && typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
        result[key] = this.mergeConfig(base[key] || {}, updates[key]);
      } else {
        result[key] = updates[key];
      }
    }
    
    return result;
  }
}

export default {
  defaultGraph3DConfig,
  performanceProfiles,
  themes,
  Graph3DConfigManager
};