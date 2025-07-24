"use client";

import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  loadChatList,
  deleteChat,
  renameChatTitle,
  updateChatTitleOptimistic,
  clearMessages,
  setCurrentChatId,
  selectAllChats,
  Chat as ChatType,
} from "@/lib/features/chat/chatSlice";
import { showAuthModal } from "@/lib/features/auth/authSlice";
import { chatApi } from "@/lib/api/services/chat";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  Calendar,
  MessageCircle,
  MessageSquare,
  CalendarDays,
  Clock,
  MoreHorizontal,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  Sparkles,
  Video,
  Zap,
  Cpu,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDebouncedCallback } from "use-debounce";

type Uniforms = {
  [key: string]: {
    value: number[] | number[][] | number;
    type: string;
  };
};

interface ShaderProps {
  source: string;
  uniforms: {
    [key: string]: {
      value: number[] | number[][] | number;
      type: string;
    };
  };
  maxFps?: number;
}

type SortBy = "date" | "title" | "messages";
type SortOrder = "asc" | "desc";
type ViewMode = "grid" | "list";

// Canvas Reveal Effect Component
export const CanvasRevealEffect = ({
  animationSpeed = 3,
  opacities = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1],
  colors = [[59, 130, 246]], // Blue theme for ChatTube
  containerClassName,
  dotSize,
  showGradient = true,
  reverse = false,
}: {
  animationSpeed?: number;
  opacities?: number[];
  colors?: number[][];
  containerClassName?: string;
  dotSize?: number;
  showGradient?: boolean;
  reverse?: boolean;
}) => {
  return (
    <div className={cn("h-full relative w-full", containerClassName)}>
      <div className="h-full w-full">
        <DotMatrix
          colors={colors ?? [[59, 130, 246]]}
          dotSize={dotSize ?? 3}
          opacities={
            opacities ?? [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1]
          }
          shader={`
            ${reverse ? "u_reverse_active" : "false"}_;
            animation_speed_factor_${animationSpeed.toFixed(1)}_;
          `}
          center={["x", "y"]}
        />
      </div>
      {showGradient && (
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      )}
    </div>
  );
};

interface DotMatrixProps {
  colors?: number[][];
  opacities?: number[];
  totalSize?: number;
  dotSize?: number;
  shader?: string;
  center?: ("x" | "y")[];
}

const DotMatrix: React.FC<DotMatrixProps> = ({
  colors = [[59, 130, 246]],
  opacities = [0.04, 0.04, 0.04, 0.04, 0.04, 0.08, 0.08, 0.08, 0.08, 0.14],
  totalSize = 20,
  dotSize = 2,
  shader = "",
  center = ["x", "y"],
}) => {
  const uniforms = React.useMemo(() => {
    let colorsArray = [
      colors[0],
      colors[0],
      colors[0],
      colors[0],
      colors[0],
      colors[0],
    ];
    if (colors.length === 2) {
      colorsArray = [
        colors[0],
        colors[0],
        colors[0],
        colors[1],
        colors[1],
        colors[1],
      ];
    } else if (colors.length === 3) {
      colorsArray = [
        colors[0],
        colors[0],
        colors[1],
        colors[1],
        colors[2],
        colors[2],
      ];
    }
    return {
      u_colors: {
        value: colorsArray.map((color) => [
          color[0] / 255,
          color[1] / 255,
          color[2] / 255,
        ]),
        type: "uniform3fv",
      },
      u_opacities: {
        value: opacities,
        type: "uniform1fv",
      },
      u_total_size: {
        value: totalSize,
        type: "uniform1f",
      },
      u_dot_size: {
        value: dotSize,
        type: "uniform1f",
      },
      u_reverse: {
        value: shader.includes("u_reverse_active") ? 1 : 0,
        type: "uniform1i",
      },
    };
  }, [colors, opacities, totalSize, dotSize, shader]);

  return (
    <Shader
      source={`
        precision mediump float;
        in vec2 fragCoord;

        uniform float u_time;
        uniform float u_opacities[10];
        uniform vec3 u_colors[6];
        uniform float u_total_size;
        uniform float u_dot_size;
        uniform vec2 u_resolution;
        uniform int u_reverse;

        out vec4 fragColor;

        float PHI = 1.61803398874989484820459;
        float random(vec2 xy) {
            return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
        }
        float map(float value, float min1, float max1, float min2, float max2) {
            return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
        }

        void main() {
            vec2 st = fragCoord.xy;
            ${
              center.includes("x")
                ? "st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));"
                : ""
            }
            ${
              center.includes("y")
                ? "st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));"
                : ""
            }

            float opacity = step(0.0, st.x);
            opacity *= step(0.0, st.y);

            vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

            float frequency = 5.0;
            float show_offset = random(st2);
            float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
            opacity *= u_opacities[int(rand * 10.0)];
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

            vec3 color = u_colors[int(show_offset * 6.0)];

            float animation_speed_factor = 0.5;
            vec2 center_grid = u_resolution / 2.0 / u_total_size;
            float dist_from_center = distance(center_grid, st2);

            float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);
            float max_grid_dist = distance(center_grid, vec2(0.0, 0.0));
            float timing_offset_outro = (max_grid_dist - dist_from_center) * 0.02 + (random(st2 + 42.0) * 0.2);

            float current_timing_offset;
            if (u_reverse == 1) {
                current_timing_offset = timing_offset_outro;
                opacity *= 1.0 - step(current_timing_offset, u_time * animation_speed_factor);
                opacity *= clamp((step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            } else {
                current_timing_offset = timing_offset_intro;
                opacity *= step(current_timing_offset, u_time * animation_speed_factor);
                opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            }

            fragColor = vec4(color, opacity);
            fragColor.rgb *= fragColor.a;
        }`}
      uniforms={uniforms}
      maxFps={60}
    />
  );
};

const ShaderMaterial = ({
  source,
  uniforms,
  maxFps = 60,
}: {
  source: string;
  hovered?: boolean;
  maxFps?: number;
  uniforms: Uniforms;
}) => {
  const { size } = useThree();
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const timestamp = clock.getElapsedTime();

    const material: any = ref.current.material;
    const timeLocation = material.uniforms.u_time;
    timeLocation.value = timestamp;
  });

  const getUniforms = () => {
    const preparedUniforms: any = {};

    for (const uniformName in uniforms) {
      const uniform: any = uniforms[uniformName];

      switch (uniform.type) {
        case "uniform1f":
          preparedUniforms[uniformName] = { value: uniform.value, type: "1f" };
          break;
        case "uniform1i":
          preparedUniforms[uniformName] = { value: uniform.value, type: "1i" };
          break;
        case "uniform3f":
          preparedUniforms[uniformName] = {
            value: new THREE.Vector3().fromArray(uniform.value),
            type: "3f",
          };
          break;
        case "uniform1fv":
          preparedUniforms[uniformName] = { value: uniform.value, type: "1fv" };
          break;
        case "uniform3fv":
          preparedUniforms[uniformName] = {
            value: uniform.value.map((v: number[]) =>
              new THREE.Vector3().fromArray(v)
            ),
            type: "3fv",
          };
          break;
        case "uniform2f":
          preparedUniforms[uniformName] = {
            value: new THREE.Vector2().fromArray(uniform.value),
            type: "2f",
          };
          break;
        default:
          console.error(`Invalid uniform type for '${uniformName}'.`);
          break;
      }
    }

    preparedUniforms["u_time"] = { value: 0, type: "1f" };
    preparedUniforms["u_resolution"] = {
      value: new THREE.Vector2(size.width * 2, size.height * 2),
    };
    return preparedUniforms;
  };

  const material = useMemo(() => {
    const materialObject = new THREE.ShaderMaterial({
      vertexShader: `
      precision mediump float;
      in vec2 coordinates;
      uniform vec2 u_resolution;
      out vec2 fragCoord;
      void main(){
        float x = position.x;
        float y = position.y;
        gl_Position = vec4(x, y, 0.0, 1.0);
        fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;
        fragCoord.y = u_resolution.y - fragCoord.y;
      }
      `,
      fragmentShader: source,
      uniforms: getUniforms(),
      glslVersion: THREE.GLSL3,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
    });

    return materialObject;
  }, [size.width, size.height, source]);

  return (
    <mesh ref={ref as any}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const Shader: React.FC<ShaderProps> = ({ source, uniforms, maxFps = 60 }) => {
  return (
    <Canvas className="absolute inset-0 h-full w-full">
      <ShaderMaterial source={source} uniforms={uniforms} maxFps={maxFps} />
    </Canvas>
  );
};

interface WelcomePageProps {}

export function WelcomePage({}: WelcomePageProps = {}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const chatList = useAppSelector(selectAllChats);
  const { chatListLoading, chatListError } = useAppSelector(
    (state) => state.chat
  );
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Load chat list on component mount only if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(loadChatList({}));
    }
  }, [dispatch, isAuthenticated]);

  const filteredAndSortedChats = chatList
    .filter(
      (chat: ChatType) =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a: ChatType, b: ChatType) => {
      let comparison = 0;

      switch (sortBy) {
        case "date":
          comparison =
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "messages":
          comparison = a.messageCount - b.messageCount;
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Pagination calculations
  const totalChats = filteredAndSortedChats.length;
  const totalPages = Math.ceil(totalChats / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedChats = filteredAndSortedChats.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, sortOrder]);

  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const creatingRef = useRef(false);
  const lastCallRef = useRef(0);

  const handleCreateNewChat = useCallback(
    async (event?: React.MouseEvent) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      const now = Date.now();
      console.log(
        "🚀 handleCreateNewChat called, isCreatingChat:",
        isCreatingChat,
        "creatingRef:",
        creatingRef.current
      );

      if (now - lastCallRef.current < 1000) {
        console.log("🛑 Debounce: too soon since last call");
        return;
      }

      if (isCreatingChat || creatingRef.current) {
        console.log("🛑 Already creating chat, returning early");
        return;
      }

      console.log("✅ Setting creation flags to true");
      lastCallRef.current = now;
      creatingRef.current = true;
      setIsCreatingChat(true);

      try {
        console.log("📡 Making API call to create chat...");
        const response = await chatApi.createChat();
        const newChatId = response.chat._id;
        console.log("✅ Chat created successfully:", newChatId);

        router.push(`/chat/${newChatId}`);
      } catch (error) {
        console.error("❌ Failed to create new chat:", error);
      } finally {
        console.log("🔄 Setting creation flags to false");
        creatingRef.current = false;
        setIsCreatingChat(false);
      }
    },
    [isCreatingChat, router]
  );

  const handleChatClick = (chatId: string) => {
    router.push(`/chat/${chatId}`);
  };

  // Debounced function for optimistic updates (faster feedback)
  const debouncedOptimisticUpdate = useDebouncedCallback(
    (chatId: string, title: string, originalTitle: string) => {
      if (title.trim() && title.trim() !== originalTitle) {
        dispatch(
          updateChatTitleOptimistic({
            chatId,
            title: title.trim(),
          })
        );
      }
    },
    200
  );

  // Debounced function to save title changes to API
  const debouncedSaveTitle = useDebouncedCallback(
    (chatId: string, title: string, originalTitle: string) => {
      if (title.trim() && title.trim() !== originalTitle) {
        dispatch(renameChatTitle({ chatId, title: title.trim() }));
      }
    },
    1000
  );

  const handleRenameStart = (chatId: string, currentTitle: string) => {
    setEditingChatId(chatId);
    setEditingTitle(currentTitle);
  };

  const handleTitleChange = (newTitle: string, originalTitle: string) => {
    setEditingTitle(newTitle);

    if (editingChatId) {
      debouncedOptimisticUpdate(editingChatId, newTitle, originalTitle);
      debouncedSaveTitle(editingChatId, newTitle, originalTitle);
    }
  };

  const handleRenameConfirm = () => {
    if (editingChatId && editingTitle.trim()) {
      const currentChat = chatList.find((chat) => chat.id === editingChatId);
      if (currentChat && editingTitle.trim() !== currentChat.title) {
        dispatch(
          renameChatTitle({ chatId: editingChatId, title: editingTitle.trim() })
        );
      }
    }
    setEditingChatId(null);
    setEditingTitle("");
  };

  const handleRenameCancel = () => {
    setEditingChatId(null);
    setEditingTitle("");
  };

  const handleDeleteStart = (chatId: string) => {
    setChatToDelete(chatId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (chatToDelete) {
      dispatch(deleteChat(chatToDelete));
    }
    setDeleteDialogOpen(false);
    setChatToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setChatToDelete(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 z-0">
        <CanvasRevealEffect
          animationSpeed={2}
          containerClassName="bg-background"
          colors={[
            [59, 130, 246], // Blue
            [147, 51, 234], // Purple
            [236, 72, 153], // Pink
          ]}
          dotSize={4}
          reverse={false}
        />
        {/* Theme-aware overlay - darker for light theme, lighter for dark theme */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.4)_0%,_transparent_100%)] dark:bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.3)_0%,_transparent_100%)]" />
        {/* Theme-aware gradient overlays */}
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-background/90 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-background/90 to-transparent" />
        {/* Additional light theme overlay to soften the canvas effect */}
        <div className="absolute inset-0 bg-background/30 dark:bg-background/0" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="pt-20 pb-16 px-4 sm:px-6"
        >
          <div className="max-w-7xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="space-y-8"
            >
              <div className="space-y-6">
                <motion.h1
                  className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-none"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                >
                  <span className="text-foreground">Welcome to</span>
                  <br />
                  <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                    ChatTube
                  </span>
                </motion.h1>
                <motion.p
                  className="text-muted-foreground text-xl sm:text-2xl lg:text-3xl font-light leading-relaxed max-w-4xl mx-auto"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                >
                  Transform your video content into intelligent conversations
                  with our advanced AI analysis platform
                </motion.p>
              </div>

              {/* Feature Tags */}
              <motion.div
                className="flex flex-wrap justify-center gap-4"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.7 }}
              >
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <Badge
                    variant="outline"
                    className="text-base py-3 px-6 bg-background/20 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-colors"
                  >
                    <Video className="h-5 w-5 text-primary mr-2" />
                    Video Analysis
                  </Badge>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <Badge
                    variant="outline"
                    className="text-base py-3 px-6 bg-background/20 backdrop-blur-sm border-purple-500/20 hover:border-purple-500/40 transition-colors"
                  >
                    <Cpu className="h-5 w-5 text-purple-500 mr-2" />
                    AI Powered
                  </Badge>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <Badge
                    variant="outline"
                    className="text-base py-3 px-6 bg-background/20 backdrop-blur-sm border-pink-500/20 hover:border-pink-500/40 transition-colors"
                  >
                    <Sparkles className="h-5 w-5 text-pink-500 mr-2" />
                    Smart Insights
                  </Badge>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* Authentication or Main Content */}
        {!isAuthenticated ? (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="flex items-center justify-center px-4 min-h-[50vh]"
          >
            <div className="text-center py-16 max-w-md">
              <motion.div
                className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-3xl flex items-center justify-center backdrop-blur-sm border border-primary/20"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.3 }}
              >
                <MessageCircle className="h-12 w-12 text-primary" />
              </motion.div>
              <motion.h3
                className="text-3xl font-bold mb-4 text-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
              >
                Begin your journey
              </motion.h3>
              <motion.p
                className="text-muted-foreground mb-8 text-lg leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                Sign in to unlock the full potential of AI-powered video
                conversations and access your personal chat history
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={() => dispatch(showAuthModal("login"))}
                  className="relative overflow-hidden bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 gap-3 px-10 py-6 text-lg font-medium rounded-2xl transition-all duration-300 shadow-2xl hover:shadow-purple-500/15 dark:hover:shadow-purple-500/25 text-white group"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <MessageCircle className="h-6 w-6 relative z-10" />
                  <span className="relative z-10">Get Started</span>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="mt-8 px-4 sm:px-6 pb-8"
          >
            <div className="w-full max-w-7xl mx-auto">
              {chatListError ? (
                <motion.div
                  className="text-center py-16"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-destructive/20 to-red-500/20 rounded-3xl flex items-center justify-center backdrop-blur-sm border border-destructive/20">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-foreground">
                    Unable to load conversations
                  </h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {chatListError}
                  </p>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      onClick={() => dispatch(loadChatList({}))}
                      variant="outline"
                      className="px-8 py-4 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-all duration-300"
                    >
                      Try Again
                    </Button>
                  </motion.div>
                </motion.div>
              ) : chatListLoading && (!chatList || chatList.length === 0) ? (
                <motion.div
                  className="text-center py-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <motion.div
                    className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-3xl flex items-center justify-center backdrop-blur-sm border border-primary/20"
                    animate={{
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <MessageCircle className="h-12 w-12 text-primary" />
                  </motion.div>
                  <p className="text-muted-foreground text-xl">
                    Loading your conversations...
                  </p>
                </motion.div>
              ) : chatList.length === 0 ? (
                <motion.div
                  className="text-center py-20"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  <motion.div
                    className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-3xl flex items-center justify-center backdrop-blur-sm border border-primary/20"
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <MessageCircle className="h-12 w-12 text-primary" />
                  </motion.div>
                  <h3 className="text-3xl font-bold mb-4 text-foreground">
                    Your conversation space awaits
                  </h3>
                  <p className="text-muted-foreground mb-8 text-xl leading-relaxed max-w-md mx-auto">
                    Start your first intelligent conversation with video content
                  </p>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      onClick={(e) => handleCreateNewChat(e)}
                      disabled={isCreatingChat}
                      className="relative overflow-hidden bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 gap-3 px-10 py-6 text-lg font-medium rounded-2xl transition-all duration-300 shadow-2xl hover:shadow-purple-500/15 dark:hover:shadow-purple-500/25 text-white group disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <Plus className="h-6 w-6 relative z-10" />
                      <span className="relative z-10">
                        {isCreatingChat
                          ? "Creating Chat..."
                          : "Create Your First Chat"}
                      </span>
                    </Button>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  className="rounded-2xl border border-border/50 bg-background/20 backdrop-blur-sm shadow-2xl overflow-hidden"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  {/* Action Bar */}
                  <div className="p-6 border-b border-border/50 bg-background/10">
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                      <div className="flex items-center gap-4">
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Button
                            onClick={(e) => handleCreateNewChat(e)}
                            disabled={isCreatingChat}
                            className="relative overflow-hidden bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 gap-3 px-6 py-3 text-base font-medium rounded-xl transition-all duration-300 shadow-lg hover:shadow-purple-500/15 dark:hover:shadow-purple-500/25 text-white group disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <Plus className="h-5 w-5 relative z-10" />
                            <span className="relative z-10">
                              {isCreatingChat ? "Creating..." : "New Chat"}
                            </span>
                          </Button>
                        </motion.div>
                        <div className="hidden sm:block w-px h-10 bg-border/50" />
                      </div>

                      {/* Search and Controls */}
                      <div className="flex-1 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center w-full lg:w-auto">
                        <div className="relative flex-1 max-w-lg">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-background/50 backdrop-blur-sm border-border/50 rounded-lg focus:border-primary/50 transition-all duration-300"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Sort Controls */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <motion.div whileHover={{ scale: 1.05 }}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2 px-3 py-2 rounded-lg hover:bg-background/50 backdrop-blur-sm"
                                >
                                  {sortOrder === "asc" ? (
                                    <SortAsc className="h-4 w-4" />
                                  ) : (
                                    <SortDesc className="h-4 w-4" />
                                  )}
                                  <span className="hidden sm:inline">Sort</span>
                                </Button>
                              </motion.div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="rounded-xl border-border/50 bg-background/95 backdrop-blur-sm">
                              <DropdownMenuItem
                                onClick={() => setSortBy("date")}
                                className={`rounded-lg ${
                                  sortBy === "date" ? "bg-accent" : ""
                                }`}
                              >
                                <Calendar className="h-4 w-4 mr-2" />
                                Date
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setSortBy("title")}
                                className={`rounded-lg ${
                                  sortBy === "title" ? "bg-accent" : ""
                                }`}
                              >
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Title
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setSortBy("messages")}
                                className={`rounded-lg ${
                                  sortBy === "messages" ? "bg-accent" : ""
                                }`}
                              >
                                <Clock className="h-4 w-4 mr-2" />
                                Messages
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <motion.div whileHover={{ scale: 1.05 }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setSortOrder(
                                  sortOrder === "asc" ? "desc" : "asc"
                                )
                              }
                              className="rounded-lg hover:bg-background/50 backdrop-blur-sm"
                            >
                              {sortOrder === "asc" ? (
                                <SortAsc className="h-4 w-4" />
                              ) : (
                                <SortDesc className="h-4 w-4" />
                              )}
                            </Button>
                          </motion.div>

                          {/* View Mode Toggle */}
                          <div className="flex border border-border/50 rounded-lg overflow-hidden bg-background/20 backdrop-blur-sm">
                            <motion.div whileHover={{ scale: 1.02 }}>
                              <Button
                                variant={
                                  viewMode === "list" ? "default" : "ghost"
                                }
                                size="sm"
                                onClick={() => setViewMode("list")}
                                className="rounded-none px-3"
                              >
                                <List className="h-4 w-4" />
                              </Button>
                            </motion.div>
                            <motion.div whileHover={{ scale: 1.02 }}>
                              <Button
                                variant={
                                  viewMode === "grid" ? "default" : "ghost"
                                }
                                size="sm"
                                onClick={() => setViewMode("grid")}
                                className="rounded-none border-l px-3"
                              >
                                <Grid3X3 className="h-4 w-4" />
                              </Button>
                            </motion.div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chat List */}
                  <AnimatePresence mode="wait">
                    {viewMode === "list" ? (
                      <motion.div
                        key="list-view"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                      >
                        <table className="w-full text-sm">
                          <thead className="text-xs text-muted-foreground bg-background/20">
                            <tr>
                              <th className="p-4 font-medium text-left">
                                Chat Title
                              </th>
                              <th className="p-4 font-medium text-right">
                                Messages
                              </th>
                              <th className="p-4 font-medium text-right">
                                Last Updated
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedChats.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="p-8 text-center">
                                  <motion.div
                                    className="space-y-4"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5 }}
                                  >
                                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-muted/20 to-muted/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-muted/20">
                                      <Search className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-medium mb-2 text-foreground">
                                        No conversations match your search
                                      </h3>
                                      <p className="text-muted-foreground">
                                        Try adjusting your search terms to find
                                        what you're looking for
                                      </p>
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            ) : (
                              paginatedChats.map(
                                (chat: ChatType, index: number) => (
                                  <motion.tr
                                    key={chat.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{
                                      duration: 0.3,
                                      delay: index * 0.05,
                                    }}
                                    className={`
                                     group border-t border-border/30 hover:bg-background/30 cursor-pointer transition-all duration-300
                                     ${
                                       index === paginatedChats.length - 1
                                         ? ""
                                         : "border-b border-border/30"
                                     }
                                   `}
                                    whileHover={{ scale: 1.01 }}
                                  >
                                    {editingChatId === chat.id ? (
                                      <td colSpan={3} className="p-4">
                                        <div className="flex items-center gap-3">
                                          <Input
                                            value={editingTitle}
                                            onChange={(e) => {
                                              const currentChat =
                                                paginatedChats.find(
                                                  (c: ChatType) =>
                                                    c.id === editingChatId
                                                );
                                              handleTitleChange(
                                                e.target.value,
                                                currentChat?.title || ""
                                              );
                                            }}
                                            className="flex-1 h-9 text-sm bg-background/50 backdrop-blur-sm border-border/50 rounded-lg"
                                            autoFocus
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") {
                                                handleRenameConfirm();
                                              } else if (e.key === "Escape") {
                                                handleRenameCancel();
                                              }
                                            }}
                                          />
                                          <motion.div
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                          >
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={handleRenameConfirm}
                                              className="h-9 w-9 p-0 hover:bg-green-500/20 hover:text-green-600 rounded-lg"
                                            >
                                              <Check className="h-4 w-4" />
                                            </Button>
                                          </motion.div>
                                          <motion.div
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                          >
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={handleRenameCancel}
                                              className="h-9 w-9 p-0 hover:bg-red-500/20 hover:text-red-600 rounded-lg"
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          </motion.div>
                                        </div>
                                      </td>
                                    ) : (
                                      <>
                                        <td
                                          className="p-4 font-medium text-foreground group-hover:text-primary transition-colors"
                                          onClick={() =>
                                            handleChatClick(chat.id)
                                          }
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="line-clamp-1 flex items-center gap-2">
                                              {chat.emoji && (
                                                <span className="text-lg">
                                                  {chat.emoji}
                                                </span>
                                              )}
                                              {chat.title}
                                            </span>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <motion.div
                                                  whileHover={{ scale: 1.1 }}
                                                >
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 rounded-lg ml-2"
                                                    onClick={(e) =>
                                                      e.stopPropagation()
                                                    }
                                                  >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                  </Button>
                                                </motion.div>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent
                                                align="end"
                                                className="rounded-xl border-border/50 bg-background/95 backdrop-blur-sm"
                                              >
                                                <DropdownMenuItem
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRenameStart(
                                                      chat.id,
                                                      chat.title
                                                    );
                                                  }}
                                                  className="rounded-lg"
                                                >
                                                  <Edit2 className="h-4 w-4 mr-2" />
                                                  Rename
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteStart(chat.id);
                                                  }}
                                                  className="text-destructive focus:text-destructive rounded-lg"
                                                >
                                                  <Trash2 className="h-4 w-4 mr-2" />
                                                  Delete
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                        </td>
                                        <td
                                          className="p-4 text-muted-foreground text-right"
                                          onClick={() =>
                                            handleChatClick(chat.id)
                                          }
                                        >
                                          <div className="flex items-center justify-end gap-2">
                                            <MessageSquare className="h-3.5 w-3.5" />
                                            <span>{chat.messageCount}</span>
                                          </div>
                                        </td>
                                        <td
                                          className="p-4 text-muted-foreground text-right"
                                          onClick={() =>
                                            handleChatClick(chat.id)
                                          }
                                        >
                                          <div className="flex items-center justify-end gap-2">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            <span>
                                              {formatDate(chat.timestamp)}
                                            </span>
                                          </div>
                                        </td>
                                      </>
                                    )}
                                  </motion.tr>
                                )
                              )
                            )}
                          </tbody>
                        </table>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="grid-view"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="p-6"
                      >
                        {paginatedChats.length === 0 ? (
                          <motion.div
                            className="text-center py-16"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                          >
                            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-muted/20 to-muted/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-muted/20">
                              <Search className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-medium mb-4 text-foreground">
                              No conversations match your search
                            </h3>
                            <p className="text-muted-foreground">
                              Try adjusting your search terms to find what
                              you're looking for
                            </p>
                          </motion.div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {paginatedChats.map(
                              (chat: ChatType, index: number) => (
                                <motion.div
                                  key={chat.id}
                                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  transition={{
                                    duration: 0.3,
                                    delay: index * 0.1,
                                  }}
                                  whileHover={{
                                    scale: 1.02,
                                    y: -5,
                                    boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                                  }}
                                  className="group bg-background/20 backdrop-blur-sm border border-border/50 rounded-2xl p-6 aspect-square flex flex-col justify-between cursor-pointer transition-all duration-300 hover:border-primary/30"
                                >
                                  {editingChatId === chat.id ? (
                                    <div className="flex items-center gap-3 flex-1">
                                      <Input
                                        value={editingTitle}
                                        onChange={(e) => {
                                          const currentChat =
                                            paginatedChats.find(
                                              (c: ChatType) =>
                                                c.id === editingChatId
                                            );
                                          handleTitleChange(
                                            e.target.value,
                                            currentChat?.title || ""
                                          );
                                        }}
                                        className="h-10 text-base font-medium bg-background/80 backdrop-blur-sm border-border/50 rounded-lg"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            handleRenameConfirm();
                                          } else if (e.key === "Escape") {
                                            handleRenameCancel();
                                          }
                                        }}
                                      />
                                      <motion.div
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                      >
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={handleRenameConfirm}
                                          className="h-10 w-10 p-0 hover:bg-green-500/20 hover:text-green-600 rounded-lg"
                                        >
                                          <Check className="h-4 w-4" />
                                        </Button>
                                      </motion.div>
                                      <motion.div
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                      >
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={handleRenameCancel}
                                          className="h-10 w-10 p-0 hover:bg-red-500/20 hover:text-red-600 rounded-lg"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </motion.div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="space-y-4">
                                        <div className="flex items-start justify-between w-full">
                                          <h3
                                            className="font-medium text-lg line-clamp-2 text-foreground hover:text-primary transition-colors cursor-pointer leading-snug flex items-start gap-2"
                                            onClick={() =>
                                              handleChatClick(chat.id)
                                            }
                                          >
                                            {chat.emoji && (
                                              <span className="text-xl flex-shrink-0 mt-0.5">
                                                {chat.emoji}
                                              </span>
                                            )}
                                            <span className="flex-1">
                                              {chat.title}
                                            </span>
                                          </h3>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <motion.div
                                                whileHover={{ scale: 1.1 }}
                                              >
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-primary/10 rounded-lg"
                                                >
                                                  <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                              </motion.div>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                              align="end"
                                              className="rounded-xl border-border/50 bg-background/95 backdrop-blur-sm"
                                            >
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  handleRenameStart(
                                                    chat.id,
                                                    chat.title
                                                  )
                                                }
                                                className="rounded-lg"
                                              >
                                                <Edit2 className="h-4 w-4 mr-2" />
                                                Rename
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  handleDeleteStart(chat.id)
                                                }
                                                className="text-destructive focus:text-destructive rounded-lg"
                                              >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                        <p
                                          className="text-muted-foreground line-clamp-3 leading-relaxed cursor-pointer"
                                          onClick={() =>
                                            handleChatClick(chat.id)
                                          }
                                        >
                                          {chat.lastMessage}
                                        </p>
                                      </div>
                                      <div className="flex items-center justify-between pt-4 border-t border-border/30">
                                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <MessageCircle className="h-4 w-4" />
                                          {chat.messageCount} messages
                                        </span>
                                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <Clock className="h-4 w-4" />
                                          {formatDate(chat.timestamp)}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </motion.div>
                              )
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <motion.div
                      className="p-4 border-t border-border/50 bg-background/10"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Showing {startIndex + 1} to{" "}
                          {Math.min(endIndex, totalChats)} of {totalChats}{" "}
                          conversations
                        </div>
                        <div className="flex items-center gap-2">
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(1)}
                              disabled={currentPage === 1}
                              className="h-8 w-8 p-0 rounded-lg border-border/50 hover:bg-background/80 backdrop-blur-sm"
                            >
                              <ChevronsLeft className="h-4 w-4" />
                            </Button>
                          </motion.div>
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(currentPage - 1)}
                              disabled={currentPage === 1}
                              className="h-8 w-8 p-0 rounded-lg border-border/50 hover:bg-background/80 backdrop-blur-sm"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                          </motion.div>

                          {/* Page Numbers */}
                          <div className="flex items-center gap-1">
                            {Array.from(
                              { length: Math.min(5, totalPages) },
                              (_, i) => {
                                let pageNumber;
                                if (totalPages <= 5) {
                                  pageNumber = i + 1;
                                } else if (currentPage <= 3) {
                                  pageNumber = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                  pageNumber = totalPages - 4 + i;
                                } else {
                                  pageNumber = currentPage - 2 + i;
                                }

                                return (
                                  <motion.div
                                    key={pageNumber}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    <Button
                                      variant={
                                        currentPage === pageNumber
                                          ? "default"
                                          : "outline"
                                      }
                                      size="sm"
                                      onClick={() => setCurrentPage(pageNumber)}
                                      className="h-8 w-8 p-0 rounded-lg border-border/50 hover:bg-background/80 backdrop-blur-sm"
                                    >
                                      {pageNumber}
                                    </Button>
                                  </motion.div>
                                );
                              }
                            )}
                          </div>

                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(currentPage + 1)}
                              disabled={currentPage === totalPages}
                              className="h-8 w-8 p-0 rounded-lg border-border/50 hover:bg-background/80 backdrop-blur-sm"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </motion.div>
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(totalPages)}
                              disabled={currentPage === totalPages}
                              className="h-8 w-8 p-0 rounded-lg border-border/50 hover:bg-background/80 backdrop-blur-sm"
                            >
                              <ChevronsRight className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Enhanced Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteDialogOpen && (
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="rounded-2xl border-border/50 bg-background/95 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.3 }}
              >
                <DialogHeader className="space-y-4">
                  <motion.div
                    className="w-16 h-16 mx-auto bg-gradient-to-br from-destructive/20 to-red-500/20 rounded-2xl flex items-center justify-center border border-destructive/10"
                    animate={{
                      scale: [1, 1.1, 1],
                      rotate: [0, -5, 5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <Trash2 className="h-8 w-8 text-destructive" />
                  </motion.div>
                  <DialogTitle className="text-xl font-light text-center">
                    Delete Conversation
                  </DialogTitle>
                  <DialogDescription className="text-center text-muted-foreground leading-relaxed">
                    Are you sure you want to permanently delete this
                    conversation? This action cannot be undone and all messages
                    will be lost.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-3 mt-6">
                  <motion.div className="flex gap-3 w-full">
                    <motion.div
                      className="flex-1"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        variant="outline"
                        onClick={handleDeleteCancel}
                        className="w-full rounded-xl border-border/50 bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-all duration-300"
                      >
                        Cancel
                      </Button>
                    </motion.div>
                    <motion.div
                      className="flex-1"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        variant="destructive"
                        onClick={handleDeleteConfirm}
                        className="w-full rounded-xl bg-gradient-to-r from-destructive to-red-600 hover:from-destructive/90 hover:to-red-600/90 transition-all duration-300"
                      >
                        Delete Forever
                      </Button>
                    </motion.div>
                  </motion.div>
                </DialogFooter>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
