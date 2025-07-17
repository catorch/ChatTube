'use client';

import { useState } from 'react';
import { useAppDispatch } from '@/lib/hooks';
import { addSource } from '@/lib/features/sources/sourcesSlice';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Youtube, 
  FileText, 
  Globe, 
  Mic, 
  Upload,
  Link,
  Sparkles
} from 'lucide-react';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const sourceTypes = [
  { id: 'youtube', name: 'YouTube Video', icon: Youtube, description: 'Add a YouTube video URL' },
  { id: 'podcast', name: 'Podcast', icon: Mic, description: 'Add a podcast episode URL' },
  { id: 'document', name: 'Document', icon: FileText, description: 'Upload a document file' },
  { id: 'website', name: 'Website', icon: Globe, description: 'Add a website URL' },
];

export function AddSourceModal({ isOpen, onClose }: AddSourceModalProps) {
  const dispatch = useAppDispatch();
  const [selectedType, setSelectedType] = useState<string>('youtube');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !name.trim()) return;

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      const newSource = {
        id: Date.now().toString(),
        name: name.trim(),
        type: selectedType as 'youtube' | 'podcast' | 'document' | 'website',
        url: url.trim(),
        description: description.trim() || undefined,
        isSelected: false,
        lastUpdated: new Date(),
        status: 'processing' as const,
      };

      dispatch(addSource(newSource));
      
      // Reset form
      setUrl('');
      setName('');
      setDescription('');
      setSelectedType('youtube');
      setIsLoading(false);
      onClose();
    }, 1000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 lux-gradient rounded-lg flex items-center justify-center shadow-[var(--elev-1)]">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            Add New Source
          </DialogTitle>
          <DialogDescription>
            Add a new source to your ChatTube library. Choose the type and provide the necessary details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Source Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Source Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {sourceTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type.id)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedType === type.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <type.icon className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium text-sm">{type.name}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="url" className="text-sm font-medium">
              {selectedType === 'document' ? 'File Upload' : 'URL'}
            </Label>
            {selectedType === 'document' ? (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop your file here, or click to browse
                </p>
                <Button type="button" variant="outline" size="sm">
                  Choose File
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="url"
                  type="url"
                  placeholder={`Enter ${selectedType} URL...`}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            )}
          </div>

          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Name
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter a name for this source..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Add a brief description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="lux-gradient"
              disabled={isLoading || !url.trim() || !name.trim()}
            >
              {isLoading ? 'Adding...' : 'Add Source'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}