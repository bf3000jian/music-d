
import React, { useEffect, useState } from 'react';
import { rateLimiter } from '../services/rateLimiter';
import { Activity } from 'lucide-react';

export const RateLimitIndicator: React.FC = () => {
    const [stats, setStats] = useState({ count: 0, limit: 60 });

    useEffect(() => {
        const unsubscribe = rateLimiter.subscribe((count, limit) => {
            setStats({ count, limit });
        });
        return () => {
            unsubscribe();
        };
    }, []);

    const percentage = (stats.count / stats.limit) * 100;
    
    // Determine color based on usage
    let colorClass = "text-green-400 border-green-400/30 bg-green-400/10";
    if (percentage > 80) {
        colorClass = "text-red-400 border-red-400/30 bg-red-400/10";
    } else if (percentage > 50) {
        colorClass = "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
    }

    return (
        <div className={`fixed bottom-4 right-4 z-[100] flex items-center gap-3 px-3 py-2 rounded-lg border backdrop-blur-md shadow-lg transition-colors duration-300 ${colorClass}`}>
            <Activity size={16} className={percentage > 90 ? "animate-pulse" : ""} />
            <div className="flex flex-col text-xs font-mono">
                <span className="font-bold">API USAGE</span>
                <span>{stats.count}/{stats.limit} (5m)</span>
            </div>
        </div>
    );
};
