import type { ComponentType } from 'react'
import {
  Home, Search, Heart, Star, User, Users, Settings, Bell,
  Mail, Calendar, Clock, MapPin, Camera, Image, ShoppingBag, ShoppingCart,
  CreditCard, ArrowRight, ArrowLeft, ArrowUpRight, ChevronRight, ChevronDown, Check, X,
  Plus, Minus, Menu, Filter, Share2, Bookmark, Download, Upload,
  Play, Pause, Music, Video, Mic, Globe, Compass, Sun,
  Moon, Cloud, Leaf, Flower, Flower2, Sprout, TreePine, Mountain,
  Waves, Flame, Droplet, Sparkles, Zap, Gift, Coffee, Utensils,
  Plane, Train, Car, Bike, Ticket, Book, BookOpen, Pen,
  Palette, Brush, Scissors, Lock, Key, Shield, Eye, Info,
  Trash2, Edit, Copy, Link, Send, MessageCircle, Phone, Wifi,
  Battery, Package, Truck, Tag, Award, Trophy, Target, BarChart3,
  TrendingUp, Activity, Layers, Grid3x3, Box, Cpu, Database, Code,
  Terminal, Rocket, Circle,
} from 'lucide-react'

/** The icons a design language may use (ICON_POOL in language.ts). Named imports keep the bundler from including all of lucide. */
export const LANG_ICONS: Record<string, ComponentType<Record<string, unknown>>> = {
  Home, Search, Heart, Star, User, Users, Settings, Bell,
  Mail, Calendar, Clock, MapPin, Camera, Image, ShoppingBag, ShoppingCart,
  CreditCard, ArrowRight, ArrowLeft, ArrowUpRight, ChevronRight, ChevronDown, Check, X,
  Plus, Minus, Menu, Filter, Share2, Bookmark, Download, Upload,
  Play, Pause, Music, Video, Mic, Globe, Compass, Sun,
  Moon, Cloud, Leaf, Flower, Flower2, Sprout, TreePine, Mountain,
  Waves, Flame, Droplet, Sparkles, Zap, Gift, Coffee, Utensils,
  Plane, Train, Car, Bike, Ticket, Book, BookOpen, Pen,
  Palette, Brush, Scissors, Lock, Key, Shield, Eye, Info,
  Trash2, Edit, Copy, Link, Send, MessageCircle, Phone, Wifi,
  Battery, Package, Truck, Tag, Award, Trophy, Target, BarChart3,
  TrendingUp, Activity, Layers, Grid3x3, Box, Cpu, Database, Code,
  Terminal, Rocket, Circle,
} as unknown as Record<string, ComponentType<Record<string, unknown>>>
