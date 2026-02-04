import Image from 'next/image';

interface LoadingSpinnerProps {
    className?: string;
    size?: number;
    fullScreen?: boolean;
}

export default function LoadingSpinner({ className = "", size = 80, fullScreen = false }: LoadingSpinnerProps) {
    const containerClasses = fullScreen
        ? "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        : `flex items-center justify-center ${className}`;

    return (
        <div className={containerClasses}>
            <Image
                src="/logo/logo.svg"
                alt="Loading..."
                width={size}
                height={size}
                className="animate-[spin_3s_linear_infinite]"
            />
        </div>
    );
}
